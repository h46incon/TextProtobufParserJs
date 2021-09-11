const TextProtobufParser = require('../text_protobuf_parser')

test('env test', ()=> {
    expect(1 + 1).toBe(2)
})

test('empty', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    const result = parser.parse('')
    expect(result).toEqual({})
})

test('only whitespace', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    let test_cases = [' ', '\t', '\n', '   ', '\r\n']
    for (const s of test_cases) {
        const result = parser.parse(s)
        expect(result).toEqual({})
    }
})

test('one field', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    // test k:v format with/without spaces
    let test_cases = ['k:true', ' k:true', ' k :true', ' k : true', ' k : true ']
    for (const s of test_cases) {
        const result = parser.parse(s)
        expect(result).toEqual({k : true})
    }

    // test key name
    expect(parser.parse('_0123456789aAbBcBdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ:true')).toEqual(
        {_0123456789aAbBcBdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ : true}
    )
    // invalid key name
    expect(() => parser.parse('-')).toThrow()
    expect(() => parser.parse(':')).toThrow()
    expect(() => parser.parse(',')).toThrow()
})

test('true/false value', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    expect(parser.parse('k : true')).toEqual({k : true})
    expect(parser.parse('k : false')).toEqual({k : false})
})

test('number value', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    expect(parser.parse('k : 0')).toEqual({k : 0})
    expect(parser.parse('k : -1')).toEqual({k : -1})
    expect(parser.parse('k : 123')).toEqual({k : 123})
    expect(parser.parse('k : 456 ')).toEqual({k : 456})
    expect(parser.parse('k : -1234567')).toEqual({k : -1234567})
    expect(parser.parse('k : 1.01')).toEqual({k : 1.01})
    expect(parser.parse('k : -1.01')).toEqual({k : -1.01})

    // overflowed value save as string
    expect(parser.parse('k : 9007199254740991')).toEqual({k : 9007199254740991})
    expect(parser.parse('k : 9007199254740993')).toEqual({k : '9007199254740993'})
    expect(parser.parse('k : -9007199254740991')).toEqual({k : -9007199254740991})
    expect(parser.parse('k : -9007199254740993')).toEqual({k : '-9007199254740993'})

    // invalid number format
    expect(() => parser.parse('k : 1z')).toThrow()
    expect(() => parser.parse('k : 1-')).toThrow()
    expect(() => parser.parse('k : 1-2')).toThrow()
    expect(() => parser.parse('k : 1.2.3')).toThrow()
})

test('string value', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    // empty
    expect(parser.parse('k : ""')).toEqual({k : ""})
    expect(parser.parse('k : "" ')).toEqual({k : ""})
    // simple string without escape
    expect(parser.parse(String.raw`k : " 09azAZ,./<>?;' " `)).toEqual({k : String.raw` 09azAZ,./<>?;' `})
    // simple escape
    expect(parser.parse(String.raw`k : " \\\/\" " `)).toEqual({k : String.raw` \/" `})
    expect(parser.parse(String.raw`k : " \b\f\n\r\t " `)).toEqual({k : " \b\f\n\r\t "})
    // TODO: escape to bytes

    // invalid string format
    expect(() => parser.parse('k : "')).toThrow()
    expect(() => parser.parse('k : "\\')).toThrow()
    expect(() => parser.parse('k : "\\[')).toThrow()
})