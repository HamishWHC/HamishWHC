import {Secret} from 'aws-cdk-lib/aws-secretsmanager'
import * as cdk from 'aws-cdk-lib'
import {CodePipeline, CodePipelineSource, DockerCredential, ShellStep} from 'aws-cdk-lib/pipelines'
import {Construct} from "constructs"
import {SiteStage} from './site-stage'

export class PipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const gitHubSecret = Secret.fromSecretCompleteArn(this, 'GitHubSecret', this.node.tryGetContext("gitHubTokenSecretArn"));
        const dockerHubSecret = Secret.fromSecretCompleteArn(this, 'DockerHubSecret', this.node.tryGetContext("dockerHubLoginSecretArn"));

        const pipeline = new CodePipeline(this, 'Pipeline', {
            // The pipeline name
            pipelineName: 'hamishwhc-CDKPipeline',

            // How it will be built and synthesized
            synth: new ShellStep('Synth', {
                // Where the source can be found
                input: CodePipelineSource.gitHub('HamishWHC/HamishWHC', 'master', {
                    authentication: gitHubSecret.secretValueFromJson("token")
                }),

                // Install dependencies, build and run cdk synth
                commands: [
                    'npm ci',
                    'npm run build',
                    'npx cdk synth'
                ],
            }),

            dockerCredentials: [
                DockerCredential.dockerHub(dockerHubSecret)
            ],

            dockerEnabledForSynth: true
        });

        pipeline.addStage(new SiteStage(this, 'Prod', {stackProps: this.node.tryGetContext("stages")["prod"]}));
    }
}
