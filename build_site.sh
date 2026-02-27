#!/bin/bash
# AGPLv3.0
# https://github.com/stashapp/CommunityScripts/blob/main/LICENSE
set -euo pipefail

# builds a repository of plugins
# outputs to _site with the following structure:
# index.yml
# <plugin_id>.zip
# Each zip file contains the plugin.yml file and any other files in the same directory

outdir="$1"
if [ -z "$outdir" ]; then
    outdir="_site"
fi

rm -rf "$outdir"
mkdir -p "$outdir"

buildPlugin() 
{
    f=$1
    # get the plugin id from the directory
    dir=$(dirname "$f")
    plugin_id=$(basename "$f" .yml)

    echo "Processing $plugin_id"

    # create a directory for the version
    version=$(git log -n 1 --pretty=format:%h -- "$dir"/* 2>/dev/null || true)
    updated=$(TZ=UTC0 git log -n 1 --date="format-local:%F %T" --pretty=format:%ad -- "$dir"/* 2>/dev/null || true)
    if [ -z "$version" ]; then
        version="local"
    fi
    if [ -z "$updated" ]; then
        updated=$(date -u +"%F %T")
    fi
    
    # create the zip file
    # copy other files
    zipfile="$outdir/$plugin_id.zip"
    
    pushd "$dir" > /dev/null
    zip -r "$zipfile" . > /dev/null
    popd > /dev/null
    if [ ! -f "$zipfile" ]; then
        echo "ERROR: failed to create zip for $plugin_id at $zipfile" >&2
        exit 1
    fi

    name=$(grep "^name:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    description=$(grep "^description:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    ymlVersion=$(grep "^version:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    version="$ymlVersion-$version"
    dep=$(grep "^# requires:" "$f" | cut -c 12- | sed -e 's/\r//' | grep -v "<" || true)

    if command -v sha256sum >/dev/null 2>&1; then
        sha_val=$(sha256sum "$zipfile" | cut -d' ' -f1)
    else
        sha_val=$(shasum -a 256 "$zipfile" | cut -d' ' -f1)
    fi
    if [ -z "$sha_val" ]; then
        echo "ERROR: failed to compute sha256 for $zipfile" >&2
        exit 1
    fi

    # write to spec index
    echo "- id: $plugin_id
  name: $name
  metadata:
    description: $description
  version: $version
  date: $updated
  path: $plugin_id.zip
  sha256: $sha_val" >> "$outdir"/index.yml

    # handle dependencies
    if [ ! -z "$dep" ]; then
        echo "  requires:" >> "$outdir"/index.yml
        for d in ${dep//,/ }; do
            echo "    - $d" >> "$outdir"/index.yml
        done
    fi

    echo "" >> "$outdir"/index.yml
}

find ./plugins -mindepth 1 -name *.yml | while read file; do
    buildPlugin "$file"
done
