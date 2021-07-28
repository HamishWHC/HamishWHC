import {HttpApi, HttpMethod, PayloadFormatVersion} from '@aws-cdk/aws-apigatewayv2';
import {LambdaProxyIntegration} from '@aws-cdk/aws-apigatewayv2-integrations';
import {Certificate} from '@aws-cdk/aws-certificatemanager';
import {Behavior, CloudFrontAllowedMethods, CloudFrontWebDistribution, Distribution, HttpVersion, OriginAccessIdentity, OriginProtocolPolicy, OriginRequestPolicy, PriceClass, ViewerCertificate, ViewerProtocolPolicy} from '@aws-cdk/aws-cloudfront';
import {HttpOrigin, OriginGroup, S3Origin} from '@aws-cdk/aws-cloudfront-origins';
import {AssetCode, Function, Runtime} from '@aws-cdk/aws-lambda';
import {AaaaRecord, ARecord, HostedZone, HostedZoneAttributes, RecordTarget} from '@aws-cdk/aws-route53';
import {CloudFrontTarget} from '@aws-cdk/aws-route53-targets';
import {Bucket} from '@aws-cdk/aws-s3';
import {Asset} from '@aws-cdk/aws-s3-assets';
import {BucketDeployment, Source} from '@aws-cdk/aws-s3-deployment';
import * as cdk from '@aws-cdk/core';
import {RemovalPolicy} from '@aws-cdk/core';
import * as fs from "fs";
import * as path from "path";

export interface SiteStackProps extends cdk.StackProps {
    urls?: string[]
    cdnCertArn?: string
    hostedZoneAttributes?: HostedZoneAttributes,
    stageName: string
}

export class SiteStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props: SiteStackProps) {
        super(scope, id, props);

        const handler = new Function(this, 'handler', {
            code: AssetCode.fromAsset(
                path.join(__dirname, "../site"),
                {
                    bundling: {
                        image: cdk.DockerImage.fromRegistry("node:14"),
                        command: ["npm", "run", "cdk-docker-build-lambda"]
                    }
                }
            ),
            handler: 'index.handler',
            runtime: Runtime.NODEJS_14_X,
        })

        const api = new HttpApi(this, 'Api', {
            apiName: `HamishWHC-Api-${props.stageName}`
        })
        api.addRoutes({
            path: '/{proxy+}',
            methods: [HttpMethod.ANY],
            integration: new LambdaProxyIntegration({
                handler,
                payloadFormatVersion: PayloadFormatVersion.VERSION_1_0,
            })
        })

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
                origin: new OriginGroup({
                    primaryOrigin: new S3Origin(siteBucket, {
                        originAccessIdentity
                    }),
                    fallbackOrigin: new HttpOrigin(
                        cdk.Fn.parseDomainName(api.apiEndpoint),
                        {
                            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
                        }
                    ),
                    fallbackStatusCodes: [404],
                }),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
            },
            certificate: cdnCert,
            logBucket,
            logFilePrefix: "site-cdn/",
            domainNames: props.urls
        });

        new BucketDeployment(this, 'AssetsDeployment', {
            sources: [
                Source.asset(path.join(__dirname, "../site"), {
                    bundling: {
                        image: new cdk.DockerImage("node:14"),
                        command: ["npm", "run", "cdk-docker-build-static"]
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