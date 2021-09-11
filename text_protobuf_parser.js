class ParseErr extends Error {
    get err_i() {
        return this.#err_i;
    }
    set err_i(value) {
        this.#err_i = value
        this.message = `${this.message}, error index: ${this.#err_i}`
    }

    constructor(parse_err_msg, cur_ch) {
        super();
        this.name = 'ParserError'

        /** @type {String} */
        this.parse_err_msg = parse_err_msg
        /** @type {String} */
        this.cur_ch = cur_ch
        /** @type {Number} */
        this.#err_i = null

        // override output message
        this.message = `${this.parse_err_msg}, error character: [${cur_ch}]`
    }

    #err_i
}

class TextProtobufParser {
    #s = ''
    #i = 0

    static #white_space_set = new Set([...' \n\t\r'])
    static #number_set = new Set([...'-.0123456789'])
    static #simple_token_char_set = new Set([...'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'])

    constructor() {
    }

    /**
     * @param {string} s
     * @return {Object}
     */
    parse(s) {
        this.#s = s
        this.#i = 0
        try {
            return this.#parseMsgFields(/*break_when_right_brace=*/false)
        } catch (e) {
            if (e instanceof ParseErr) {
                e.err_i = this.#i
            }
            throw e
        }
    }

    #parseMsgFields(break_when_right_brace) {
        let msg = {}
        while(true) {
            this.#skipWhiteSpace()
            if (!this.#hasNext()) {
                break
            }

            if (break_when_right_brace && this.#next() === '}') {
                break
            }
            const field =  this.#parseField()
            if (field.name in msg) {
                // field already in msg, is a repeated field
                let new_val = msg[field.name]
                if (Array.isArray(new_val)) {
                    // protobuf could define repeated of repeated
                    // thus if a value is array, is must be a repeated value itself, not a elem of repeated value
                }
                else {
                    new_val = [new_val]
                }

                if (Array.isArray(field.value)) {
                    new_val = new_val.concat(field.value)
                }
                else {
                    new_val.push(field.value)
                }
                msg[field.name] = new_val
            }
            else {
                // single field
                Object.defineProperty(msg, field.name, {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: field.value,
                })
            }
        }
        return msg
    }

    #skipWhiteSpace() {
        while(this.#hasNext() && this.#isNextWhiteSpace()) {
            this.#skipNext()
        }
    }

    #parseField() {
        const field_name = this.#parseSimpleToken()
        this.#skipWhiteSpace()
        const ch = this.#next()

        let val = null
        switch (ch) {
            case ':':
                // simple filed
                this.#skipNext()
                val = this.#parseValue()
                break
            case '[':
                val = this.#parseArrayValue()
                break
            case '{':
                val = this.#parseMsgValue()
                break
            default:
                throw new ParseErr(`excepted field value`, ch)
        }

        return {
            name: field_name,
            value: val,
        }
    }

    /** parse a token string that all characters in char_set */
    #parseToken(char_set) {
        const beg_i = this.#i
        let end_i = this.#i
        // allow number leading token for the time being
        while(this.#hasNext() && char_set.has(this.#next())) {
            this.#skipNext()
            ++end_i
        }
        return this.#s.substring(beg_i, end_i)
    }

    #parseValue() {
        this.#skipWhiteSpace()

        const ch = this.#next()
        if (ch === 't') {
            this.#consume('true')
            return true
        }
        else if (ch === 'f') {
            this.#consume('false')
            return false
        }
        else if (ch === '"') {
            return this.#parseStringValue()
        }
        else if (ch === '[') {
            return this.#parseArrayValue()
        }
        else if (ch === '{') {
            return this.#parseMsgValue()
        }
        else if (this.#isNextNumberChar()) {
            return this.#parseNumberValue()
        }
        else {
            throw new ParseErr(`unexpected value leading character`, ch)
        }
    }

    #parseNumberValue() {
        this.#skipWhiteSpace()
        // get a token first, and then try parse
        const number_str = this.#parseToken(this.constructor.#number_set)
        const n = Number(number_str)
        if (Number.isNaN(n))  {
            throw new ParseErr(`parse number failed: ${number_str}`, '')
        }
        // if maybe overflow, return as string
        if (n > Number.MAX_SAFE_INTEGER || n < Number.MIN_SAFE_INTEGER) {
            return number_str
        }
        return n
    }

    #parseStringValue() {
        this.#consume('"')
        let val = ''

        while(true) {
            if (!this.#hasNext()) {
                throw new ParseErr(`except end of string("), but get EOF`, '\0')
            }
            const ch = this.#next()
            this.#skipNext()
            switch (ch) {
                case '"':
                    // end of string
                    return val
                case '\\':
                    val += this.#parseStringEscape()
                    break
                default:
                    val += ch
            }
        }
    }

    #parseStringEscape() {
        const ch = this.#next()
        this.#skipNext()
        switch (ch) {
            // these escaped characters is rule form JSON, we don't know text proto rule now
            case '"':  return '"'
            case '\\': return '\\'
            case '/':  return '/'
            case 'b':  return  '\b';
            case 'f':  return '\f'
            case 'n':  return '\n'
            case 'r':  return '\r'
            case 't':  return '\t'
            default:
                throw new ParseErr(`unknown escaped character`, ch)
        }
    }

    #parseArrayValue() {
        this.#consume('[')
        this.#skipWhiteSpace()
        const val = []

        while (true) {
            this.#skipWhiteSpace()
            if (!this.#hasNext()) {
                throw new ParseErr(`expect elem or end of array(]), but get EOF`, '\0')
            }
            const ch = this.#next()
            if (ch === ']') {
                this.#skipNext()
                return val
            }

            const elem = this.#parseValue()
            val.push(elem)

            this.#skipWhiteSpace()
            // must , or ] after array elem
            // allow additional , after last elem
            const ch2 = this.#next()
            this.#skipNext()
            if (ch2 === ']') {
                return val
            }
            else if (ch2 === ',') {
                // continue
            }
            else {
                throw new ParseErr(`expect , or ] of array`, ch2)
            }
        }
    }

    #parseMsgValue() {
        this.#consume('{')
        const val = this.#parseMsgFields(/*break_when_right_brace=*/true)
        this.#consume('}')
        return val
    }

    #isNextWhiteSpace() {
        return this.constructor.#white_space_set.has(this.#next())
    }

    #isNextNumberChar() {
        return this.constructor.#number_set.has(this.#next())
    }

    #parseSimpleToken() {
        return this.#parseToken(this.constructor.#simple_token_char_set)
    }


    #hasNext() {
        return this.#i < this.#s.length
    }

    #next() {
        if (!this.#hasNext()) {
            throw new ParseErr(`expect some character, but get EOF`, '\0')
        }
        return this.#s[this.#i]
    }

    #skipNext() {
        ++this.#i
    }

    #consume(str) {
        for (const c of str) {
            if (!this.#hasNext()) {
                throw new ParseErr(`expect '${c}' of "${str}", but get EOF`, '\0')
            }
            const next = this.#next()
            if (next !== c) {
                throw new ParseErr(`expect '${c}' of "${str}"`, next)
            }
            this.#skipNext()
        }
    }
}

module.exports = {
    TextProtobufParser
}
