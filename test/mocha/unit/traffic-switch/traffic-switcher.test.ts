import sinon, { SinonSpy } from 'sinon'
import { metric } from '@uniswap/smart-order-router/build/main/util/metric'
import { expect } from 'chai'
import { MetricLoggerUnit } from '@uniswap/smart-order-router'
import { TrafficSwitcher } from '../../../../lib/util/traffic-switch/traffic-switcher'

interface ISimpleTester {
  simpleMethod(): Promise<Record<string, number>>
}

class SimpleTesterControl implements ISimpleTester {
  async simpleMethod(): Promise<Record<string, number>> {
    return {
      '0x1': 1,
      '0x2': 2,
    }
  }
}

class SimpleTesterTreatment implements ISimpleTester {
  async simpleMethod(): Promise<Record<string, number>> {
    return {
      '0x1': 1,
      '0x2': 2,
    }
  }
}

class TrafficSwitcherISimpleTester extends TrafficSwitcher<ISimpleTester> implements ISimpleTester {
  async simpleMethod(): Promise<Record<string, number>> {
    return this.trafficSwitchMethod(
      () => this.props.control.simpleMethod(),
      () => this.props.treatment.simpleMethod(),
      this.simpleMethod.name,
      {},
      this.compareResults.bind(this)
    )
  }

  private compareResults(
    resultA: Record<string, number> | undefined,
    resultB: Record<string, number> | undefined
  ): void {
    // Check if both results are undefined or only one of them is. If so, log and return
    if (!resultA && !resultB) {
      this.logComparisonResult(this.simpleMethod.name, 'IDENTICAL', true)
      return
    }
    if (!resultA) {
      this.logComparisonResult(this.simpleMethod.name, this.props.aliasControl + '_IS_UNDEFINED', true)
      return
    }
    if (!resultB) {
      this.logComparisonResult(this.simpleMethod.name, this.props.aliasTreatment + '_IS_UNDEFINED', true)
      return
    }

    // We have results from both implementations, compare them as a whole
    const identical = JSON.stringify(resultA) === JSON.stringify(resultB)
    this.logComparisonResult(this.simpleMethod.name, 'IDENTICAL', identical)

    // Go deeper and let's do more granular custom comparisons
    if (!identical) {
      // Compare the number of results
      const comparisonResultLength = Object.keys(resultA).length === Object.keys(resultB).length
      this.logComparisonResult(this.simpleMethod.name, 'LENGTHS_MATCH', comparisonResultLength)

      // find and log the differences: what's missing in A, what's missing in B, and what's different
      const keysA = Object.keys(resultA)
      const keysB = Object.keys(resultB)
      const missingInA = keysB.filter((k) => !keysA.includes(k))
      const missingInB = keysA.filter((k) => !keysB.includes(k))
      missingInA.forEach((k) =>
        this.logMetric(this.simpleMethod.name, 'MISSING_IN_' + this.props.aliasControl + '__Address__' + k)
      )
      missingInB.forEach((k) =>
        this.logMetric(this.simpleMethod.name, 'MISSING_IN_' + this.props.aliasTreatment + '__Address__' + k)
      )
      // find common keys with diffs
      const commonKeys = keysA.filter((k) => keysB.includes(k))
      const commonKeysWithDifferentFees = commonKeys.filter(
        (k) => JSON.stringify(resultA[k]) !== JSON.stringify(resultB[k])
      )
      commonKeysWithDifferentFees.forEach((k) => {
        this.logMetric(this.simpleMethod.name, 'DIFFERENT_FEE_FOR__Address__' + k)
      })
    }
  }
}

describe('TrafficSwitcher', () => {
  let spy: SinonSpy

  const methodReturn100 = async (): Promise<Record<string, number>> => {
    return {
      '0x1': 100,
      '0x2': 100,
    }
  }
  const methodReturn200 = async (): Promise<Record<string, number>> => {
    return {
      '0x1': 200,
      '0x2': 200,
    }
  }
  const methodThrowsException = async (): Promise<Record<string, number>> => {
    throw new Error('Exception!')
  }

  beforeEach(() => {
    spy = sinon.spy(metric, 'putMetric')
  })

  afterEach(() => {
    spy.restore()
  })

  it('switch traffic 100% should get result from treatment', async () => {
    const controlImplentation = sinon.createStubInstance(SimpleTesterControl)
    const treatmentImplementation = sinon.createStubInstance(SimpleTesterTreatment)
    controlImplentation.simpleMethod.callsFake(methodReturn100)
    treatmentImplementation.simpleMethod.callsFake(methodReturn200)

    const trafficSwitchProvider = new TrafficSwitcherISimpleTester('Exp1', {
      control: controlImplentation,
      treatment: treatmentImplementation,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 1.0,
        pctShadowSampling: 0.0,
      },
    })

    const result = await trafficSwitchProvider.simpleMethod()

    for (const key in result) {
      expect(result[key]).to.equal(200)
    }

    sinon.assert.notCalled(controlImplentation.simpleMethod)
    sinon.assert.calledOnce(treatmentImplementation.simpleMethod)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'SELECTED_IMPL__Target'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('switch traffic 0% should get result from control', async () => {
    const controlImplentation = sinon.createStubInstance(SimpleTesterControl)
    const treatmentImplementation = sinon.createStubInstance(SimpleTesterTreatment)
    controlImplentation.simpleMethod.callsFake(methodReturn100)
    treatmentImplementation.simpleMethod.callsFake(methodReturn200)

    const trafficSwitchProvider = new TrafficSwitcherISimpleTester('Exp1', {
      control: controlImplentation,
      treatment: treatmentImplementation,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 0.0,
      },
    })

    const result = await trafficSwitchProvider.simpleMethod()

    for (const key in result) {
      expect(result[key]).to.equal(100)
    }

    sinon.assert.notCalled(treatmentImplementation.simpleMethod)
    sinon.assert.calledOnce(controlImplentation.simpleMethod)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'SELECTED_IMPL__Current'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('sampling traffic 100% should get results from both (Identical), and return control impl result', async () => {
    const controlImplentation = sinon.createStubInstance(SimpleTesterControl)
    const treatmentImplementation = sinon.createStubInstance(SimpleTesterTreatment)
    controlImplentation.simpleMethod.callsFake(methodReturn100)
    treatmentImplementation.simpleMethod.callsFake(methodReturn100)

    const trafficSwitchProvider = new TrafficSwitcherISimpleTester('Exp1', {
      control: controlImplentation,
      treatment: treatmentImplementation,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 1.0,
      },
    })

    const result = await trafficSwitchProvider.simpleMethod()

    for (const key in result) {
      expect(result[key]).to.equal(100)
    }

    sinon.assert.calledOnce(controlImplentation.simpleMethod)
    sinon.assert.calledOnce(treatmentImplementation.simpleMethod)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'COMPARISON_SAMPLE'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'COMPARISON__IDENTICAL__RESULT__YES'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('sampling traffic 100% should get results from both (Different), and return Current impl result', async () => {
    const controlImplentation = sinon.createStubInstance(SimpleTesterControl)
    const treatmentImplementation = sinon.createStubInstance(SimpleTesterTreatment)
    controlImplentation.simpleMethod.callsFake(methodReturn100)
    treatmentImplementation.simpleMethod.callsFake(methodReturn200)

    const trafficSwitchProvider = new TrafficSwitcherISimpleTester('Exp1', {
      control: controlImplentation,
      treatment: treatmentImplementation,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 1.0,
      },
    })

    const result = await trafficSwitchProvider.simpleMethod()

    for (const key in result) {
      expect(result[key]).to.equal(100)
    }

    sinon.assert.calledOnce(controlImplentation.simpleMethod)
    sinon.assert.calledOnce(treatmentImplementation.simpleMethod)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'COMPARISON_SAMPLE'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'COMPARISON__IDENTICAL__RESULT__NO'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'COMPARISON__LENGTHS_MATCH__RESULT__YES'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'DIFFERENT_FEE_FOR__Address__0x1'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'DIFFERENT_FEE_FOR__Address__0x2'),
      1,
      MetricLoggerUnit.Count
    )
  })

  it('sampling traffic 100% with target impl exception should still return Current impl result', async () => {
    const controlImplentation = sinon.createStubInstance(SimpleTesterControl)
    const treatmentImplementation = sinon.createStubInstance(SimpleTesterTreatment)
    controlImplentation.simpleMethod.callsFake(methodReturn100)
    treatmentImplementation.simpleMethod.callsFake(methodThrowsException)

    const trafficSwitchProvider = new TrafficSwitcherISimpleTester('Exp1', {
      control: controlImplentation,
      treatment: treatmentImplementation,
      aliasControl: 'Current',
      aliasTreatment: 'Target',
      customization: {
        pctEnabled: 0.0,
        pctShadowSampling: 1.0,
      },
    })

    const result = await trafficSwitchProvider.simpleMethod()

    for (const key in result) {
      expect(result[key]).to.equal(100)
    }

    sinon.assert.calledOnce(controlImplentation.simpleMethod)
    sinon.assert.calledOnce(treatmentImplementation.simpleMethod)
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'COMPARISON_SAMPLE'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'Target_EXCEPTION'),
      1,
      MetricLoggerUnit.Count
    )
    sinon.assert.calledWith(
      spy,
      TrafficSwitcher.METRIC_NAME_TEMPLATE.replace('{EXP}', 'Exp1')
        .replace('{METHOD}', 'simpleMethod')
        .replace('{METRIC}', 'COMPARISON__Target_IS_UNDEFINED__RESULT__YES'),
      1,
      MetricLoggerUnit.Count
    )
  })
})
