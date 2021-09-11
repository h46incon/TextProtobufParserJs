class ParseErr extends Error {
    get err_i() {
        return this.#err_i;
    }
    set err_i(value) {
        this.#err_i = value
        this.message = `${this.message}, error index: ${this.#err_i}`
    }

    // TODO: override toString()

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

class EnumValue {
    /**
     * @param v {String}
     */
    constructor(v) {
        this.v = v
    }
}

function JsonStringifyReplacer(key, value) {
    if (value instanceof EnumValue) {
        return value.v
    }
    else if (typeof(value) === 'bigint') {
        return value.toString()
    }
    if (value instanceof Uint8Array) {
        if (typeof window === 'undefined') {
            return Buffer.from(value).toString('base64')
        } else {
            return window.btoa(String.fromCharCode.apply(null, value));
        }
    }
    else {
        return value
    }
}

class TextProtobufParser {
    #s = ''
    #i = 0

    static #white_space_set = new Set([...' \n\t\r'])
    static #number_set = new Set([...'-.0123456789'])
    static #prue_number_set = new Set([...'0123456789'])
    static #simple_token_char_set = new Set([...'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_'])

    constructor() {
    }

    /**
     * @param {String} s
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

    /**
     * @param {String} s
     * @return {string}
     */
    parseToJson(s) {
        const msg = this.parse(s)
        return JSON.stringify(msg, JsonStringifyReplacer)
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
        if (ch === '"') {
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
        else if (this.#isNextSimpleTokenChar()) {
            // NOTE: must judge isNextNumberChar(), true/false token before isNextSimpleTokenChar()
            const token = this.#parseSimpleToken()
            // enum value that encode as a simple token
            // it's not easy judge a token type without protobuf Message definition,
            // i.e maybe a enum named true/false/nan, but we must assume the judging priority
            if (token === 'true') {
                return true
            } else if (token === 'false') {
                return false
            } else if (token === 'nan') {
                // NOTE: google text_format parser will recognize inf/-inf/infinity/-infinity/-nan also
                // but only generate nan is current implementation
                return Number.NaN
            } else {
                return new EnumValue(token)
            }
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
        if (!Number.isInteger(n)) {
            // float
            return n
        }

        // integer maybe overflow, return as BigInt
        if (n > Number.MAX_SAFE_INTEGER || n < Number.MIN_SAFE_INTEGER) {
            return BigInt(number_str)
        }
        return n
    }

    #parseStringValue() {
        this.#consume('"')
        const utf8_encoder = new TextEncoder()

        let bytes = []
        while (true) {
            if (!this.#hasNext()) {
                throw new ParseErr(`except end of string("), but get EOF`, '\0')
            }
            const ch = this.#next()
            this.#skipNext()
            if (ch === '"') {
                // end of string
                break
            } else if (ch === '\\') {
                bytes.push(this.#parseEscapedUint8())
            } else {
                bytes = bytes.concat(...utf8_encoder.encode(ch))
            }
        }

        const uint8_array = new Uint8Array(bytes)
        const utf8_decoder = new TextDecoder('utf-8', {fatal: true})
        try {
            return utf8_decoder.decode(uint8_array)
        } catch(e) {
            // could not decode into utf8 string, maybe a protobuf bytes value, return bytes directly
            return uint8_array
        }
    }

    #parseEscapedUint8() {
        const ch = this.#next()
        this.#skipNext()
        switch (ch) {
            case 'n':  return '\n'.charCodeAt(0)
            case 'r':  return '\r'.charCodeAt(0)
            case 't':  return '\t'.charCodeAt(0)
            case '"':  return '"'.charCodeAt(0)
            case '\'':  return '\''.charCodeAt(0)
            case '\\': return '\\'.charCodeAt(0)
            case '/':  return '/'.charCodeAt(0)
            case 'b':  return  '\b'.charCodeAt(0)
            case 'f':  return '\f'.charCodeAt(0)
            default:
                if (this.constructor.#prue_number_set.has(ch)) {
                    this.#unSkipNext()
                    return this.#parseCodePoint()
                }
                else {
                    throw new ParseErr(`unknown escaped character`, ch)
                }
        }
    }

    #parseCodePoint() {
        const maxCodePointSize = 3
        const beg_i = this.#i
        let end_i = beg_i
        for (let i = 0; i < maxCodePointSize && this.#hasNext(); ++i) {
            if (this.constructor.#prue_number_set.has(this.#next())) {
                ++end_i
                this.#skipNext()
            }
            else {
                break
            }
        }
        const code_point_str = this.#s.substring(beg_i, end_i)
        const code_point = parseInt(code_point_str, 8)
        if (code_point > 255) {
            throw new ParseErr(`code point out of range: ${code_point_str}`, '')
        }
        return code_point
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

    #isNextSimpleTokenChar() {
        return this.constructor.#simple_token_char_set.has(this.#next())
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

    #unSkipNext() {
        --this.#i
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
    ParseErr,
    EnumValue,
    TextProtobufParser,
}
