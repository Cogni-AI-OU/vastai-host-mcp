import type { AppConfig } from '../config.js';

export interface PricingRecommendationInput {
  current_price_gpu: number;
  dlperf_score: number;
  reliability_score: number;
  gpu_utilization_percent: number;
}

export interface ReliabilityRecommendationInput {
  failed_jobs_24h: number;
  uptime_percent_30d: number;
  verification_passed: boolean;
}

export class MCPRules {
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  public getAutomationSummary(): string {
    const pricing = this.config.vastAutoPricingEnabled ? 'enabled' : 'disabled';
    const reliability = this.config.vastAutoReliabilityGuard ? 'enabled' : 'disabled';

    return `Automation status: auto-pricing is ${pricing}; reliability guard is ${reliability}.`;
  }

  public recommendPricing(input: PricingRecommendationInput): {
    recommended_price_gpu: number;
    rationale: string;
  } {
    const reliabilityWeight = Math.max(0.7, Math.min(1.2, input.reliability_score / 100));
    const performanceWeight = Math.max(0.75, Math.min(1.25, input.dlperf_score / 100));
    const utilizationAdjustment = input.gpu_utilization_percent > 90 ? 1.08 : 0.96;

    const recommended =
      input.current_price_gpu * reliabilityWeight * performanceWeight * utilizationAdjustment;

    return {
      recommended_price_gpu: Number(recommended.toFixed(4)),
      rationale:
        'Recommendation combines DLPerf, reliability, and recent utilization. ' +
        'Higher reliability/performance can justify a modest premium.'
    };
  }

  public recommendReliabilityActions(input: ReliabilityRecommendationInput): {
    actions: string[];
    summary: string;
  } {
    const actions: string[] = [];

    if (!input.verification_passed) {
      actions.push('Run a machine self-test and fix verification blockers before relisting.');
    }

    if (input.failed_jobs_24h >= 3) {
      actions.push('Inspect host logs and restart unstable services (docker, nvidia-persistenced, or host daemon).');
    }

    if (input.uptime_percent_30d < 99) {
      actions.push('Review maintenance windows and reduce unplanned downtime to improve host ranking.');
    }

    if (actions.length === 0) {
      actions.push('No immediate reliability intervention required. Continue routine self-tests.');
    }

    return {
      actions,
      summary: `Generated ${actions.length} reliability recommendation(s) for host-side operations.`
    };
  }
}
