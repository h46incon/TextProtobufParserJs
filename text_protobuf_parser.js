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
        return this.#parseMsgFields(/*break_when_right_brace=*/false)
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
            // TODO: handler repeated
            Object.defineProperty(msg, field.name, {
                configurable: true,
                enumerable: true,
                value: field.value,
            })
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
        const c = this.#next()

        let val = null
        switch (c) {
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
                throw `excepted field value, but get ${c}`
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

        const c = this.#next()
        if (c === 't') {
            this.#consume('true')
            return true
        }
        else if (c === 'f') {
            this.#consume('false')
            return false
        }
        else if (c === '"') {
            return this.#parseStringValue()
        }
        else if (c === '[') {
            return this.#parseArrayValue()
        }
        else if (c === '{') {
            return this.#parseMsgValue()
        }
        else if (this.#isNextNumberChar()) {
            return this.#parseNumberValue()
        }
        else {
            throw `unexpected value leading character "${c}"`
        }
    }

    #parseNumberValue() {
        this.#skipWhiteSpace()
        // get a token first, and then try parse
        const number_str = this.#parseToken(this.constructor.#number_set)
        const n = Number(number_str)
        if (Number.isNaN(n))  {
            throw `parse number failed: ${number_str}`
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
                throw `except end of string("), but get EOF`
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
                throw `unknown escaped character \\${ch}`
        }
    }

    #parseArrayValue() {
        this.#consume('[')
        this.#skipWhiteSpace()
        const val = []

        while (true) {
            this.#skipWhiteSpace()
            if (!this.#hasNext()) {
                throw `expect elem or end of array(]), but get EOF`
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
                throw `expect , or ] of array, but get ${ch2}`
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
            throw `expect some character, but get EOF`
        }
        return this.#s[this.#i]
    }

    #skipNext() {
        ++this.#i
    }

    #consume(str) {
        for (const c of str) {
            if (!this.#hasNext()) {
                throw `expect '${c}' of "${str}", but get EOF`
            }
            const next = this.#next()
            if (next !== c) {
                throw `expect '${c}' of "${str}", but get ${next}`
            }
            this.#skipNext()
        }
    }
}

module.exports = {
    TextProtobufParser
}
