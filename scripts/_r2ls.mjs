import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnv(f){const o={};if(!existsSync(f))return o;for(const l of readFileSync(f,"utf8").split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);if(m)o[m[1]]=m[2].replace(/^["']|["']$/g,"");}return o;}
const E={...loadEnv(join(REPO,".env")),...loadEnv(join(REPO,".env.local"))};
const aws=new AwsClient({accessKeyId:E.ACCESS_KEY_ID,secretAccessKey:E.SECRET_ACCESS_KEY,region:"auto",service:"s3"});
const prefix=process.argv[2]??"";
let token,n=0;
do{
  const u=new URL(`${E.ENDPOINT.replace(/\/$/,"")}/${E.BUCKET}`);
  u.searchParams.set("list-type","2"); u.searchParams.set("prefix",prefix); u.searchParams.set("max-keys","1000");
  if(token)u.searchParams.set("continuation-token",token);
  const r=await aws.fetch(u); const t=await r.text();
  for(const m of t.matchAll(/<Key>([^<]+)<\/Key><Size>(\d+)<\/Size>/g)){console.log(m[2].padStart(9),m[1]);n++;}
  token=t.match(/<NextContinuationToken>([^<]+)</)?.[1];
}while(token);
console.error(`${n} objects under "${prefix}"`);
