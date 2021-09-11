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
    expect(() => parser.parse('k: @')).toThrow()
    expect(() => parser.parse('k: \\')).toThrow()
    expect(() => parser.parse('k: \'')).toThrow()
    expect(() => parser.parse('k: *')).toThrow()
    // invalid value
})

test('multi field', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    expect(parser.parse('i:true j :false\nk : true\tl :false')).toEqual({i: true, j: false, k: true, l:false})
    // err format
    expect(() => parser.parse('i:true :,')).toThrow()
    expect(() => parser.parse('i:true j')).toThrow()
    expect(() => parser.parse('i:true j:')).toThrow()
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
    // non-ascii
    expect(parser.parse(String.raw`k : "你好，世界！Hello, World!" `)).toEqual({k : String.raw`你好，世界！Hello, World!`})
    // simple escape
    expect(parser.parse(String.raw`k : " \\\/\"\' " `)).toEqual({k : String.raw` \/"' `})
    expect(parser.parse(String.raw`k : " \b\f\n\r\t " `)).toEqual({k : " \b\f\n\r\t "})
    // escape to bytes
    expect(parser.parse(String.raw`k : "\40\040\1760" `)).toEqual({k : "  ~0"})
    const chn_encoded = String.raw`\345\275\223\345\211\215\347\212\266\346\200\201\347\246\201\346\255\242\346\255\244\351\241\271\346\223\215\344\275\234`
    expect(parser.parse(`k : "${chn_encoded}"`)).toEqual({k : "当前状态禁止此项操作"})

    // invalid string format
    expect(() => parser.parse('k : "')).toThrow()
    expect(() => parser.parse('k : "\\')).toThrow()
    expect(() => parser.parse('k : "\\[')).toThrow()
})

test('bytes value', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    expect(parser.parse(String.raw`k : "\377\376\375" `)).toEqual({k : new Uint8Array([255, 254, 253])})
    expect(parser.parse(String.raw`k : "012\377\376\375" `)).toEqual({k : new Uint8Array([48, 49, 50, 255, 254, 253])})
})

test('short repeated value', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    expect(() => parser.parse('k : [')).toThrow()
    expect(() => parser.parse('k : [ ')).toThrow()
    expect(() => parser.parse('k [ ')).toThrow()
    expect(() => parser.parse('k : [1')).toThrow()

    expect(parser.parse('k : []')).toEqual({k : []})
    expect(parser.parse('k : [ ]')).toEqual({k : []})
    expect(parser.parse('k : [1]')).toEqual({k : [1]})
    expect(parser.parse('k : [ 1 ]')).toEqual({k : [1]})

    expect(parser.parse('k : [1,]')).toEqual({k : [1]})

    expect(parser.parse('k : [1,3]')).toEqual({k : [1, 3]})
    expect(parser.parse('k : [ 1, 3]')).toEqual({k : [1, 3]})
    expect(parser.parse('k : [ 1, 3 ]')).toEqual({k : [1, 3]})
    expect(parser.parse('k : [ 1, 3 ,]')).toEqual({k : [1, 3]})
    expect(parser.parse('k : ["1", "2", "3", "4"]')).toEqual({k : ['1', '2', '3', '4']})

    expect(parser.parse('k [1,2,3]')).toEqual({k : [1,2,3]})

})

test ('repetitive field name', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    expect(parser.parse('i:1 j:2 i:3 k:4 j:5')).toEqual({i: [1,3], j: [2, 5], k: 4})
    expect(parser.parse('i:1 j:2 i:3 i:4 i:5')).toEqual({i: [1,3,4,5], j: 2})
    expect(parser.parse('i:[1] i:2')).toEqual({i: [1,2]})
    expect(parser.parse('i:[1,2] i:[3,4] i:5')).toEqual({i: [1,2,3,4,5]})
    expect(parser.parse('i:1 i:[3,4]')).toEqual({i: [1,3,4]})
})

test('message value', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    expect(parser.parse('i: {j: 1}')).toEqual({i: {j: 1}})
    expect(parser.parse('i{j: 1}')).toEqual({i: {j: 1}})
    expect(parser.parse('i {j: 1}')).toEqual({i: {j: 1}})
    expect(parser.parse('i\n {j: 1}')).toEqual({i: {j: 1}})
    expect(parser.parse('i\t {j: 1}')).toEqual({i: {j: 1}})
    expect(parser.parse('i {i: 1 j: "2" k: true}')).toEqual({i: {i: 1, j: "2", k: true}})
    // err format
    expect(() => parser.parse('i: {')).toThrow()
    expect(() => parser.parse('i: {j')).toThrow()
    expect(() => parser.parse('i: {j:')).toThrow()
})

test('nested type', () => {
    let parser = new TextProtobufParser.TextProtobufParser()
    expect(() => parser.parse('i: {j: {i: 2}')).toThrow()
    expect(() => parser.parse('i: [{j:1 k:2}, {j:3 k:4},')).toThrow()

    // message in message
    expect(parser.parse('i: {j: {i:2 j:true}}')).toEqual({i: {j: {i: 2, j:true}}})
    expect(parser.parse('i {j {i:2 j:true} k: 3}')).toEqual({i: {j: {i: 2, j:true}, k: 3}})

    // array in message
    expect(parser.parse('i: {j: [1,2,3]}')).toEqual({i: {j: [1,2,3]}})
    expect(parser.parse('i: {j: [1,2,3] j: 4}')).toEqual({i: {j: [1,2,3,4]}})

    // message in array
    expect(parser.parse('i: [{j:1 k:2}, {j:3 k:4}, ] i {j:4 k:6}')).toEqual({i: [{j:1, k:2}, {j:3, k:4}, {j:4, k:6}]})
})