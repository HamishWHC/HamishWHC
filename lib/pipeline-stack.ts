import * as cdk from '@aws-cdk/core';
import {SecretValue} from '@aws-cdk/core';
import {CodeBuildStep, CodePipeline, CodePipelineSource, ShellStep} from '@aws-cdk/pipelines';
import {SiteStage} from './site-stage';

export class PipelineStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const pipeline = new CodePipeline(this, 'Pipeline', {
            // The pipeline name
            pipelineName: 'hamishwhc-CDKPipeline',

            // How it will be built and synthesized
            synth: new ShellStep('Synth', {
                // Where the source can be found
                input: CodePipelineSource.gitHub('HamishWHC/HamishWHC', 'master', {
                    authentication: SecretValue.secretsManager('github-token', {jsonField: "token"})
                }),

                // Install dependencies, build and run cdk synth
                commands: [
                    'npm ci',
                    'npm run build',
                    'npx cdk synth'
                ],
            }),
        });

        pipeline.addStage(new SiteStage(this, 'Prod'));
    }
}
