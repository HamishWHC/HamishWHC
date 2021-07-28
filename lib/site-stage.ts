import {CfnOutput, Construct, Stage, StageProps} from '@aws-cdk/core';
import {SiteStack, SiteStackProps} from './site-stack';

/**
 * Deployable unit of web service app
 */

interface SiteStageProps extends StageProps {
    stackProps: Omit<SiteStackProps, "stageName">
}
export class SiteStage extends Stage {
    public readonly urlOutput: CfnOutput;

    constructor(scope: Construct, id: string, props: SiteStageProps) {
        super(scope, id, props);

        new SiteStack(this, `hamishwhc-SiteStack`, {...props.stackProps, stageName: id.toLowerCase()});
    }
}