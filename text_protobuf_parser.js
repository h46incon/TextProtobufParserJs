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
        return this.#parseMsgFields()
    }

    #parseMsgFields() {
        let msg = {}
        while(true) {
            this.#skipWhiteSpace()
            if (!this.#hasNext()) {
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
        } else if (c === 'f') {
            this.#consume('false')
            return false
        } else if (c === '"') {
            return this.#parseStringValue()

        } else if (this.#isNextNumberChar()) {
            return this.#parseNumberValue()
        } else {
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
        let beg_i = this.#i
        let val = ''

        while(true) {
            const ch = this.#next()
            this.#skipNext()
            switch (ch) {
                case '"':
                    // end of string
                    return val
                case '\\':
                    throw `not support string escape now`;
                default:
                    val += ch
            }
        }
    }

    #isNextWhiteSpace() {
        return this.constructor.#white_space_set.has(this.#next())
    }

    #isNextNumberChar() {
        return this.constructor.#number_set.has(this.#next())
    }

    #isNextTokenChar() {
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
