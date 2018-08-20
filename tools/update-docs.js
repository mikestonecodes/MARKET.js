require('dotenv').config();
var _a = require("shelljs"), cd = _a.cd, exec = _a.exec, echo = _a.echo, touch = _a.touch, mkdir = _a.mkdir, cp = _a.cp;
var readFileSync = require("fs").readFileSync;
var url = require("url");
var s3 = require("s3");
var tmpfile = process.env.DOC_TMP_DIR || '/tmp/docs-aws';
require('dotenv').config();
echo("Deploying docs!!!");
echo("Deploying docsaewfjweioafjoew!!!");
mkdir(tmpfile);
mkdir(tmpfile + "/alltags");
cd(tmpfile);
exec("git init");
exec("git clone  https://github.com/MARKETProtocol/MARKET.js.git ");
cd("MARKET.js");
console.log(process.env.AWS_ACCESS_KEY, process.env.AWS_SECRET, process.env.AWS_REGION);
var uploadToAws = function () {
    var client = s3.createClient({
        maxAsyncS3: 20,
        s3RetryCount: 3,
        s3RetryDelay: 1000,
        multipartUploadThreshold: 20971520,
        multipartUploadSize: 15728640,
        s3Options: {
            accessKeyId: process.env.AWS_ACCESS_KEY,
            secretAccessKey: process.env.AWS_SECRET,
            region: process.env.AWS_REGION,
            signatureVersion: 'v3'
        }
    });
    var params = {
        localDir: tmpfile + "/alltags/",
        deleteRemoved: true,
        // that have no corresponding local file.
        s3Params: {
            Bucket: process.env.AWS_BUCKET,
            Prefix: ""
        }
    };
    var uploader = client.uploadDir(params);
    uploader.on('error', function (err) {
        console.error("unable to sync:", err.stack);
    });
    uploader.on('progress', function () {
        console.log("progress", uploader.progressAmount, uploader.progressTotal);
    });
    uploader.on('end', function () {
        console.log("done uploading");
    });
};
exec('git tag', function (code, stdout, stderr) {
    stdout.split('\n').forEach(function (tag) {
        exec("git checkout tags/" + tag);
        cp('-Rf', "docs", tmpfile + "/alltags/" + tag);
    });
    cd(tmpfile);
    exec("git clone --depth 1 https://github.com/MARKETProtocol/docs.git -b gh-pages", function (code, stdout, stderr) {
        cp('-Rf', "docs/*", "alltags");
        uploadToAws();
    });
});
