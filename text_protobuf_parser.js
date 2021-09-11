class TextProtobufParser {
    #s = ''
    #i = 0
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

    #parseSimpleToken() {
        this.#skipWhiteSpace()
        const beg_i = this.#i
        let end_i = this.#i
        // allow number leading token for the time being
        while(this.#hasNext() && this.#isNextTokenChar()) {
            this.#skipNext()
            ++end_i
        }
        return this.#s.substring(beg_i, end_i)
    }

    #parseValue() {
        this.#skipWhiteSpace()

        const c = this.#next()
        switch (c) {
            case 't':
                this.#consume('true')
                return true
            case 'f':
                this.#consume('false')
                return false
            default:
                throw `unexpected value leading character "${c}"`
        }
    }

    static #white_space_set = new Set([...' \n\t\r'])
    #isNextWhiteSpace() {
        return this.constructor.#white_space_set.has(this.#next())
    }

    static #token_char_set = new Set([...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXZY0123456789_'])
    #isNextTokenChar() {
        return this.constructor.#token_char_set.has(this.#next())
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
