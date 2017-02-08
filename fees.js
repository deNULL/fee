var Num = require('big-rational');

function applyFees(chain, basis, time, payload) {
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

    var rules = chain[id].rules;
    var amount;

    // In case no rules will match
    fees[id].active = false;
    fess[id].invalid = false;
    fess[id].amount = Num.zero;

    for (var i = 0; i < rules.length; i++) {

      if ('match' in rules[i]) {
        if (typeof rules[i].match == 'function') {
          if (!rules[i].match(basis, input, output, time, payload, fees)) {
            continue;
          }
        } else {
          var matched = true;
          for (var k in rules[i].match) {
            if (payload[k] != rules[i].match[k]) {
              matched = false;
              break;
            }
          }
          if (!matched) {
            continue;
          }
        }
      }

      if ('since' in rules[i]) {
        if (time < rules[i].since) {
          continue;
        }
      }

      if ('till' in rules[i]) {
        if (time > rules[i].till) {
          continue;
        }
      }

      var comp = [
        'gt',
        'greater',
        'geq',
        'greaterOrEquals',
        'lt',
        'lesser',
        'leq',
        'lesserOrEquals',
        'eq',
        'equals',
        'neq',
        'notEquals'
      ];

      var valid = true;
      for (var j = 0; j < comp.length; j++) {
        if (comp[j] in rules[i]) {
          if (!input[comp[j]](rules[i][comp[j]])) {
            valid = false;
            break;
          }
        }
      }

      if (!valid) {
        continue;
      }

      if ('func' in rules[i]) {
        amount = Num(rules[i].func(basis, input, output, time, payload, fees));
      } else
      if ('fixed' in rules[i]) {
        amount = Num(rules[i].fixed);
      } else {
        amount = input.multiply(rules[i].percent).divide(100);
      }

      if ('min' in rules[i]) {
        amount = amount.lesser(rules[i].min) ? Num(rules[i].min) : amount;
      }

      if ('max' in rules[i]) {
        amount = amount.greater(rules[i].max) ? Num(rules[i].max) : amount;
      }

      fees[id].active = true;
      fees[id].invalid = amount.isNegative();
      fees[id].amount = amount;
      break;
    }
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

var dt = new Date();
var results = applyFees({
  quokka:   { type: 'outer', rules: [{ percent: 5 }] },
  terminal: { type: 'outer', rules: [{ percent: 2, min: 5.00, max: 10.00 }] },
  other:    { type: 'outer', after: ['quokka'], rules: [{ percent: 1 }] },
  bank:     { type: 'inner', after: ['other', 'terminal'], rules: [{ percent: 5 }] }
}, 100.00, dt.getHours() * 3600 + dt.getMinutes() * 60);

console.log(results);

exports.apply = applyFees;
