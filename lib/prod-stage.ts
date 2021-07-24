import { CfnOutput, Construct, Stage, StageProps } from '@aws-cdk/core';
import { SiteStack } from './site-stack';

/**
 * Deployable unit of web service app
 */
export class ProdStage extends Stage {
  public readonly urlOutput: CfnOutput;
  
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    new SiteStack(this, 'hamishwhc-SiteStack-Prod');
  }
}