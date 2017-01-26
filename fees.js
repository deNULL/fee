var Num = require('big-rational');

function applyFees(chain, basis, payload) {
  basis = Num(basis);

  var fees = {};
  function apply(id) {
    if (fees[id].applied == 'applying') {
      throw new Error('Circular reference');
    }

    if (fees[id].applied) {
      return;
    }

    fees[id].applied = 'applying';

    var input = basis;
    var output = basis;
    if ('after' in chain[id]) {
      for (var i = 0; i < chain[id].after.length; i++) {
        var prev = chain[id].after[i];
        apply(prev);
        if (chain[prev].type == 'inner') {
          output = output.subtract(fees[prev].amount);
        } else
        if (chain[prev].type == 'outer') {
          input = input.add(fees[prev].amount);
        }
      }
    }

    var amount;

    if ('match' in chain[id]) {
      for (var k in chain[id].match) {
        if (payload[k] != chain[id].match[k]) {
          fees[id].active = false;
          fees[id].invalid = false;
          fees[id].amount = Num.zero;
          fees[id].applied = true;
          return;
        }
      }
    }

    if ('func' in chain[id]) {
      amount = Num(chain[id].func(basis, input, output, payload, fees));
    } else
    if ('fixed' in chain[id]) {
      amount = Num(chain[id].fixed);
    } else {
      amount = input.multiply(chain[id].percent).divide(100);
    }

    if ('min' in chain[id]) {
      amount = amount.lesser(chain[id].min) ? Num(chain[id].min) : amount;
    }

    if ('max' in chain[id]) {
      amount = amount.greater(chain[id].max) ? Num(chain[id].max) : amount;
    }

    fees[id].active = true;
    fees[id].invalid = amount.isNegative();
    fees[id].amount = amount;
    fees[id].applied = true;
  }

  for (var k in chain) {
    fees[k] = { applied: false };
  }
  for (var k in chain) {
    apply(k);
  }

  var input = basis;
  var output = basis;
  var invalid = false;
  for (var k in chain) {
    delete fees[k].applied;

    if (chain[k].type == 'inner') {
      output = output.subtract(fees[k].amount);
    } else
    if (chain[k].type == 'outer') {
      input = input.add(fees[k].amount);
    }
    invalid = invalid || fees[k].invalid;
  }

  return {
    input: input,
    output: output,
    fees: fees,
    invalid: invalid
  }
}

var results = applyFees({
  quokka:   { type: 'outer', percent: 5 },
  terminal: { type: 'outer', percent: 2, min: 5.00, max: 10.00 },
  other:    { type: 'outer', after: ['quokka'], percent: 1 },
  bank:     { type: 'inner', after: ['other', 'terminal'], percent: 5 }
}, 100.00);

console.log(results);

exports.apply = applyFees;
