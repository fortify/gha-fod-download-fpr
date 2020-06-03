import * as core from '@actions/core';
import * as io from '@actions/io';
import needle from 'needle';

const AUTH_SCOPE = 'view-issues';

function getApiBaseUrl() : URL {
    const baseUrlString = core.getInput('base-url', {required: true});
    let baseUrl = new URL(baseUrlString);
    if ( !baseUrl.hostname.startsWith('api') ) {
        baseUrl.hostname = 'api.' + baseUrl.hostname;
    }
    return baseUrl;
}

function getApiBaseUrlString() : string {
    return getApiBaseUrl().toString();
}

function getEndpointUrl(endpoint: string) : URL {
    return new URL(endpoint, getApiBaseUrl());
}

function getEndpointUrlString(endpoint: string) : string {
    return getEndpointUrl(endpoint).toString();
}

function getPasswordAuthPayload() {
    const tenant = core.getInput('tenant', { required: true });
    const user = core.getInput('user', { required: true });
    const password = core.getInput('password', { required: true });

    return {
        scope: AUTH_SCOPE,
        grant_type: 'password',
        username: tenant + '\\' + user,
        password: password
    };
}

function getClientCredentialsAuthPayload() {
    const client_id = core.getInput('client-id', { required: true });
    const client_secret = core.getInput('client-secret', { required: true });

    return {
        scope: AUTH_SCOPE,
        grant_type: 'client_credentials',
        client_id: client_id,
        client_secret: client_secret
    };
}

function getAuthPayload() {
    if ( core.getInput('user', { required: false }) ) {
        return getPasswordAuthPayload();
    } else {
        return getClientCredentialsAuthPayload();
    }
}

function getReleaseId() : string {
    // TODO Add support for getting release id by application/release name
    return core.getInput('release-id', { required: true });
}

function getScanTypes() : string[] {
    return core.getInput('scanTypes', { required: true }).split(' ');
}

function getOutput(releaseId: string, scanType: string) : string {
    const outputDir = core.getInput('outputDir', { required: true });
    io.mkdirP(outputDir);
    return `${outputDir}/FoDScan-${releaseId}-${scanType}.fpr`;
}

function downloadFpr(authHeaders: any, releaseId: string, scanType: string, output: string, outputLocations: Map<string,string>) : void {
    const downloadUrl = getEndpointUrlString(`/api/v3/releases/${releaseId}/fpr?scanType=${scanType}`);
    core.info(`Downloading ${scanType} scan results from release id ${releaseId} to ${output}`);
    needle('get', downloadUrl, {headers: authHeaders, output: output})
        .then(function(result) { 
            core.info(`Downloaded ${scanType} scan results from release id ${releaseId} to ${output}`);
            outputLocations.set(scanType, output);
        })
        .catch(function(err) {
            throw `Error downloading ${scanType} scan results from release id ${releaseId}: $err`; 
        });
}

async function main() {
    core.info("Running main()");
    const authUrl = getEndpointUrlString('/oauth/token');
    const outputLocations = new Map<string, string>();
    core.info("Authenticating with FoD");
    needle('post', authUrl, getAuthPayload())
        .then(function(authResult) {
            core.info("FoD Authentication successfull");
            const authHeaders = { 
                'Authorization': 'Bearer '+ authResult.body.access_token
            };
            const releaseId = getReleaseId();
            const scanTypes = getScanTypes();
            scanTypes.forEach( scanType => downloadFpr(authHeaders, releaseId, scanType, getOutput(releaseId, scanType), outputLocations));
        })
        .catch(function(err) {
            throw err;
        });
    core.setOutput('fpr', outputLocations);
}

core.info("Calling main()");

main();