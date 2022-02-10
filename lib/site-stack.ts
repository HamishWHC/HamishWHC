import {HttpApi, HttpMethod, PayloadFormatVersion} from '@aws-cdk/aws-apigatewayv2-alpha'
import {HttpLambdaIntegration} from '@aws-cdk/aws-apigatewayv2-integrations-alpha'
import {Certificate} from 'aws-cdk-lib/aws-certificatemanager'
import {Distribution, OriginAccessIdentity, OriginProtocolPolicy, ViewerProtocolPolicy} from 'aws-cdk-lib/aws-cloudfront'
import {HttpOrigin, OriginGroup, S3Origin} from 'aws-cdk-lib/aws-cloudfront-origins'
import {AssetCode, Function, Runtime} from 'aws-cdk-lib/aws-lambda'
import {AaaaRecord, ARecord, HostedZone, HostedZoneAttributes, RecordTarget} from 'aws-cdk-lib/aws-route53'
import {CloudFrontTarget} from 'aws-cdk-lib/aws-route53-targets'
import {Bucket} from 'aws-cdk-lib/aws-s3'
import {BucketDeployment, Source} from 'aws-cdk-lib/aws-s3-deployment'
import * as cdk from 'aws-cdk-lib'
import {RemovalPolicy} from 'aws-cdk-lib'
import {Construct} from "constructs"
import * as path from "path"

export interface SiteStackProps extends cdk.StackProps {
    urls?: string[]
    cdnCertArn?: string
    hostedZoneAttributes?: HostedZoneAttributes,
    stageName: string
}

export class SiteStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: SiteStackProps) {
        super(scope, id, props);

        const logBucket = new Bucket(this, "LogsBucket");

        const siteBucket = new Bucket(this, "SiteBucket", {
            serverAccessLogsBucket: logBucket,
            serverAccessLogsPrefix: "site-s3/",
            autoDeleteObjects: true,
            removalPolicy: RemovalPolicy.DESTROY
        });
        const originAccessIdentity = new OriginAccessIdentity(this, 'OAI');
        siteBucket.grantRead(originAccessIdentity);

        const cdnCert = props.cdnCertArn && props.urls ? Certificate.fromCertificateArn(this, "CloudfrontCert", props.cdnCertArn) : undefined

        const siteCdn = new Distribution(this, "SiteCloudFront", {
            defaultBehavior: {
                origin: new S3Origin(siteBucket, {
                    originAccessIdentity
                }),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            },
            certificate: cdnCert,
            defaultRootObject: "index.html",
            logBucket,
            logFilePrefix: "site-cdn/",
            domainNames: props.urls
        });

        new BucketDeployment(this, 'AssetsDeployment', {
            sources: [
                Source.asset(path.join(__dirname, "../site"), {
                    bundling: {
                        image: new cdk.DockerImage("node:14"),
                        command: [
                            "bash", "-c", [
                                "export npm_config_cache=$(mktemp -d)",
                                "npm ci",
                                "npm run build",
                                "cp -r build/* /asset-output"
                            ].join(" && ")
                        ],
                    }
                })
            ],
            destinationBucket: siteBucket,
            retainOnDelete: false,
            distribution: siteCdn
        });

        if (props.hostedZoneAttributes && props.urls) {
            const hostedZone = HostedZone.fromHostedZoneAttributes(this, 'CDNHostedZone', props.hostedZoneAttributes);

            props.urls.forEach(url => {
                new ARecord(this, `CDNRecord-${url}-A`, {
                    zone: hostedZone,
                    target: RecordTarget.fromAlias(new CloudFrontTarget(siteCdn)),
                    recordName: url
                })
                new AaaaRecord(this, `CDNRecord-${url}-AAAA`, {
                    zone: hostedZone,
                    target: RecordTarget.fromAlias(new CloudFrontTarget(siteCdn)),
                    recordName: url
                })
            });
        }
    }
}