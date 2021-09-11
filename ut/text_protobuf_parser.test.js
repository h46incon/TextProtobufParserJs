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
})

test('simple field value', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    expect(parser.parse('k : true')).toEqual({k : true})
    expect(parser.parse('k : false')).toEqual({k : false})
})