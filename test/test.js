var assert = require('assert');
var should = require('should');
var fees = require('../fees.js');

var Assertion = should.Assertion;

Assertion.add('number', function(num) {
  this.params = { operator: 'to be a number ' + num, actual: this.obj.valueOf() };
  should.equal(this.obj, num);
});

Assertion.add('fee', function(amount, active, invalid) {
  this.params = { operator: 'to be a fee' };

  this.obj.should.have.property('amount');
  this.obj.should.have.property('active').which.is.Boolean();
  this.obj.should.have.property('invalid').which.is.Boolean();

  if (amount !== undefined) {
    this.obj.amount.should.be.a.number(amount);
  }
  if (active !== undefined) {
    this.obj.active.should.be.exactly(active);
  }
  if (invalid != undefined) {
    this.obj.invalid.should.be.exactly(invalid);
  }
});

describe('Fees', function() {
  // some arbitrary times throughout the day
  var TIME_00_00 = 00 * 3600 + 00 * 60 + 00;
  var TIME_00_01 = 00 * 3600 + 00 * 60 + 01;
  var TIME_08_00 = 08 * 3600 + 00 * 60 + 00;
  var TIME_11_59 = 11 * 3600 + 59 * 60 + 59;
  var TIME_12_00 = 12 * 3600 + 00 * 60 + 00;
  var TIME_12_01 = 12 * 3600 + 00 * 60 + 01;
  var TIME_18_00 = 18 * 3600 + 00 * 60 + 00;
  var TIME_23_59 = 23 * 3600 + 59 * 60 + 59;


  it('should not change given input without fees', function() {
    var results = fees.apply({ }, 100.0, TIME_12_00);

    results.input.should.be.a.number(100.0);
    results.output.should.be.a.number(100.0);
    results.fees.should.be.an.empty().Object();
  });

  it('should produce correct outer fee', function() {
    var results = fees.apply({
      simpleOuterFee: { type: 'outer', rules: [{ percent: 5 }] }
    }, 100.0, TIME_12_00);

    results.input.should.be.a.number(105.0);
    results.output.should.be.a.number(100.0);
    results.invalid.should.be.exactly(false);
    results.fees.simpleOuterFee.should.be.a.fee(5.0, true, false);
  });

  it('should produce correct inner fee', function() {
    var results = fees.apply({
      simpleInnerFee: { type: 'inner', rules: [{ percent: 5 }] }
    }, 100.0, TIME_12_00);

    results.input.should.be.a.number(100.0);
    results.output.should.be.a.number(95.0);
    results.invalid.should.be.exactly(false);
    results.fees.simpleInnerFee.should.be.a.fee(5.0, true, false);
  });

  it('should fail if inner fee is too large', function() {
    var results = fees.apply({
      simpleInnerFee: { type: 'inner', rules: [{ fixed: 200 }] }
    }, 100.0, TIME_12_00);

    results.input.should.be.a.number(100.0);
    results.output.should.be.a.number(-100.0);
    results.invalid.should.be.exactly(true);
    results.fees.simpleInnerFee.should.be.a.fee(200.0, true, true);
  });

  it('should correctly chain inner -> outer fees', function() {
    var results = fees.apply({
      simpleInnerFee: { type: 'inner', rules: [{ percent: 5 }] },
      simpleOuterFee: { type: 'outer', rules: [{ percent: 5 }], after: ['simpleInnerFee'] }
    }, 100.0, TIME_12_00);

    results.input.should.be.a.number(104.75);
    results.output.should.be.a.number(95.0);
    results.invalid.should.be.exactly(false);
    results.fees.simpleInnerFee.should.be.a.fee(5.0, true, false);
    results.fees.simpleOuterFee.should.be.a.fee(4.75, true, false);
  });

  it('should correctly chain outer -> inner fees', function() {
    var results = fees.apply({
      simpleInnerFee: { type: 'inner', rules: [{ percent: 5 }], after: ['simpleOuterFee'] },
      simpleOuterFee: { type: 'outer', rules: [{ percent: 5 }] }
    }, 100.0, TIME_12_00);

    results.input.should.be.a.number(105.0);
    results.output.should.be.a.number(95.0);
    results.invalid.should.be.exactly(false);
    results.fees.simpleInnerFee.should.be.a.fee(5.0, true, false);
    results.fees.simpleOuterFee.should.be.a.fee(5.0, true, false);
  });

  it('should correctly chain multiple inner fees', function() {
    var results = fees.apply({
      innerFeeA: { type: 'inner', rules: [{ percent: 5 }] },
      innerFeeB: { type: 'inner', rules: [{ percent: 5 }], after: ['innerFeeA'] }
    }, 100.0, TIME_12_00);

    results.input.should.be.a.number(100.0);
    results.output.should.be.a.number(90.25);
    results.invalid.should.be.exactly(false);
    results.fees.innerFeeA.should.be.a.fee(5.0, true, false);
    results.fees.innerFeeB.should.be.a.fee(4.75, true, false);
  });

  it('should correctly parallel multiple inner fees', function() {
    var results = fees.apply({
      innerFeeA: { type: 'inner', rules: [{ percent: 5 }] },
      innerFeeB: { type: 'inner', rules: [{ percent: 5 }] }
    }, 100.0, TIME_12_00);

    results.input.should.be.a.number(100.0);
    results.output.should.be.a.number(90.0);
    results.invalid.should.be.exactly(false);
    results.fees.innerFeeA.should.be.a.fee(5.0, true, false);
    results.fees.innerFeeB.should.be.a.fee(5.0, true, false);
  });

  it('should correctly chain (inner -> inner, inner) fees', function() {
    // Apply A and B independently, then C based only on result after A
    var results = fees.apply({
      innerFeeC: { type: 'inner', rules: [{ percent: 5 }], after: ['innerFeeB'] },
      innerFeeA: { type: 'inner', rules: [{ percent: 5 }] },
      innerFeeB: { type: 'inner', rules: [{ percent: 5 }] }
    }, 100.0, TIME_12_00);

    results.input.should.be.a.number(100.0);
    results.output.should.be.a.number(85.25);
    results.invalid.should.be.exactly(false);
    results.fees.innerFeeA.should.be.a.fee(5.0, true, false);
    results.fees.innerFeeB.should.be.a.fee(5.0, true, false);
    results.fees.innerFeeC.should.be.a.fee(4.75, true, false);
  });

  it('should correctly chain (inner, inner) -> inner fees', function() {
    // Apply A and B independently, then C based on result after A and B
    var results = fees.apply({
      innerFeeC: { type: 'inner', rules: [{ percent: 5 }], after: ['innerFeeB', 'innerFeeA'] },
      innerFeeA: { type: 'inner', rules: [{ percent: 5 }] },
      innerFeeB: { type: 'inner', rules: [{ percent: 5 }] }
    }, 100.0, TIME_12_00);

    results.input.should.be.a.number(100.0);
    results.output.should.be.a.number(85.5);
    results.invalid.should.be.exactly(false);
    results.fees.innerFeeA.should.be.a.fee(5.0, true, false);
    results.fees.innerFeeB.should.be.a.fee(5.0, true, false);
    results.fees.innerFeeC.should.be.a.fee(4.5, true, false);
  });

  it('should correctly chain multiple outer fees', function() {
    var results = fees.apply({
      outerFeeA: { type: 'outer', rules: [{ percent: 5 }] },
      outerFeeB: { type: 'outer', rules: [{ percent: 5 }], after: ['outerFeeA'] }
    }, 100.0, TIME_12_00);

    results.input.should.be.a.number(110.0);
    results.output.should.be.a.number(100.0);
    results.invalid.should.be.exactly(false);
    results.fees.outerFeeA.should.be.a.fee(5.0, true, false);
    results.fees.outerFeeB.should.be.a.fee(5.0, true, false);
  });

  it('should throw error if there\'s circular dependency between fees', function() {
    (function(){
      return fees.apply({
        innerFeeC: { type: 'inner', rules: [{ percent: 5 }], after: ['innerFeeB'] },
        innerFeeA: { type: 'inner', rules: [{ percent: 5 }], after: ['innerFeeC'] },
        innerFeeB: { type: 'inner', rules: [{ percent: 5 }], after: ['innerFeeA'] }
      }, 100.0, TIME_12_00);
    }).should.throw('Circular reference');
  });

  describe('rules', function() {
    it('should skip fees without rules', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [ ] }
      }, 100.0, TIME_12_00);

      results.input.should.be.a.number(100.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(0.0, false, false);
    });

    it('should skip fees without matching rules', function() {
      // No rules match
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          match: function(basis, input, output, time, payload, fees) {
            basis.should.be.a.number(100.0);
            input.should.be.a.number(100.0);
            output.should.be.a.number(100.0);
            time.should.be.exactly(TIME_12_00);
            payload.should.be.exactly('Some payload');
            return false;
          }
        }, {
          fixed: 12,
          match: function(basis, input, output, time, payload, fees) {
            basis.should.be.a.number(100.0);
            input.should.be.a.number(100.0);
            output.should.be.a.number(100.0);
            time.should.be.exactly(TIME_12_00);
            payload.should.be.exactly('Some payload');
            return false;
          }
        }] }
      }, 100.0, TIME_12_00, 'Some payload');

      results.input.should.be.a.number(100.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(0.0, false, false);
    });

    it('should select the first matching rule for a fee', function() {
      // Both rules match => select the first one (5, not 12)
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_12_00);

      results.input.should.be.a.number(105.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(5.0, true, false);
    });

    it('should select the rule if match function returned true', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          match: function(basis, input, output, time, payload, fees) {
            basis.should.be.a.number(100.0);
            input.should.be.a.number(100.0);
            output.should.be.a.number(100.0);
            time.should.be.exactly(TIME_12_00);
            should(payload).be.undefined();
            return true;
          }
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_12_00);

      results.input.should.be.a.number(105.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(5.0, true, false);
    });

    it('should NOT select the rule if match function returned false', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          match: function(basis, input, output, time, payload, fees) {
            basis.should.be.a.number(100.0);
            input.should.be.a.number(100.0);
            output.should.be.a.number(100.0);
            time.should.be.exactly(TIME_12_00);
            should(payload).be.undefined();
            return false;
          }
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_12_00);

      results.input.should.be.a.number(112.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(12.0, true, false);
    });

    it('should select the rule if match object is shallowly equal to the payload', function() {
      // Matches payload to match field (extra fields in the payload are ignored)
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          match: { X: 1, Y: 2, Z: 3 }
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_12_00, { X: 1, Y: 2, A: 4, Z: 3 });

      results.input.should.be.a.number(105.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(5.0, true, false);
    });

    it('should NOT select the rule if match object is not equal to the payload', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          match: { X: 1, Y: 2, Z: 3 }
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_12_00, { X: 1, Y: 2 });

      results.input.should.be.a.number(112.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(12.0, true, false);
    });

    it('should select the rule if time is before till, and since is missing', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          till: TIME_12_00
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_12_00);

      results.input.should.be.a.number(105.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(5.0, true, false);
    });

    it('should NOT select the rule if time is after till, and since is missing', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          till: TIME_12_00
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_12_01);

      results.input.should.be.a.number(112.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(12.0, true, false);
    });

    it('should select the rule if time is after since, and till is missing', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          since: TIME_12_00
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_12_00);

      results.input.should.be.a.number(105.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(5.0, true, false);
    });

    it('should NOT select the rule if time is before since, and till is missing', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          since: TIME_12_00
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_11_59);

      results.input.should.be.a.number(112.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(12.0, true, false);
    });

    it('should select the rule if time is within since/till period', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          since: TIME_08_00,
          till:  TIME_18_00,
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_12_00);

      results.input.should.be.a.number(105.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(5.0, true, false);
    });

    it('should NOT select the rule if time is before since/till period', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          since: TIME_08_00,
          till:  TIME_18_00,
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_00_01);

      results.input.should.be.a.number(112.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(12.0, true, false);
    });

    it('should NOT select the rule if time is after since/period', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          since: TIME_08_00,
          till:  TIME_18_00,
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_23_59);

      results.input.should.be.a.number(112.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(12.0, true, false);
    });

    it('should select the rule if conditions for input amount are truthy', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          eq: 100.0, // Input money = 100.0 (TRUE)
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_00_01);

      results.input.should.be.a.number(105.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(5.0, true, false);
    });

    it('should NOT select the rule if conditions for input amount are false', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 5,
          gt: 100500.0, // Input money > 100500.0 (FALSE)
        }, {
          fixed: 12
        }] }
      }, 100.0, TIME_00_01);

      results.input.should.be.a.number(112.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(12.0, true, false);
    });

    it('should apply the func for calculating fee amount if it\'s provided', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          func: function(basis, input, output, time, payload, fees) {
            basis.should.be.a.number(100.0);
            input.should.be.a.number(100.0);
            output.should.be.a.number(100.0);
            time.should.be.exactly(TIME_00_01);
            payload.should.be.exactly('Some payload');
            return 42;
          }
        }] }
      }, 100.0, TIME_00_01, 'Some payload');

      results.input.should.be.a.number(142.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(42.0, true, false);;
    });

    it('should apply fixed fee if provided', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          fixed: 12
        }] }
      }, 70.0, TIME_00_01);

      results.input.should.be.a.number(82.0);
      results.output.should.be.a.number(70.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(12.0, true, false);
    });

    it('should restrict fee with minimal value if provided', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          percent: 5,
          min: 12
        }] }
      }, 100.0, TIME_00_01);

      results.input.should.be.a.number(112.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(12.0, true, false);
    });

    it('should restrict fee with maximal value if provided', function() {
      var results = fees.apply({
        someFee: { type: 'outer', rules: [{
          percent: 5,
          max: 3
        }] }
      }, 100.0, TIME_00_01);

      results.input.should.be.a.number(103.0);
      results.output.should.be.a.number(100.0);
      results.invalid.should.be.exactly(false);
      results.fees.someFee.should.be.a.fee(3.0, true, false);
    });

    it('should fail if fee ends up negative', function() {
      var results = fees.apply({
        someFee: { type: 'inner', rules: [{
          percent: 5,
          min: 1200
        }] }
      }, 100.0, TIME_00_01);

      results.input.should.be.a.number(100.0);
      results.output.should.be.a.number(-1100.0);
      results.invalid.should.be.exactly(true);
      results.fees.someFee.should.be.a.fee(1200.0, true, true);
    });
  });
});
