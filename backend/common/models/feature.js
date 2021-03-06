'use strict';

/* global require */
/* global process */

var acl = require('../utilities/acl')
const { childProcess } = require('../utilities/child-process');
var upload = require('../utilities/upload');
var { filterBlastResults } = require('../utilities/sequence-search');

/*----------------------------------------------------------------------------*/

/** ids of sessions which have sent request : dnaSequenceSearch */
var sessionIds=[];

/** Map session ID (accessToken.id) to a small integer index.
 */
function sessionIndex(sessionId) {
  let index = sessionIds.indexOf(sessionId);
  if (index === -1) {
    sessionIds.push(sessionId);
    index = sessionIds.length - 1;
  }
  return index;
}

/*----------------------------------------------------------------------------*/

module.exports = function(Feature) {
  Feature.search = function(filter, options, cb) {
    Feature.find({
        "include": 
        {
          "block": "dataset"
        },
        "where":
        {
          "name":
          {
            "inq": filter
          }
        }
    }, options).then(function(features) {
      // filter out the features for which the user doesn't have access to the dataset
      features = features.filter(function(feature) {
        return feature.__data.block.__data.dataset
      })
      return process.nextTick(() => cb(null, features))
    })
  };

  Feature.depthSearch = function(blockId, depth, options, cb) {
    let include_n_level_features = function(includes, n) {
      if (n < 1) {
        return includes;
      }
      return include_n_level_features({'features': includes}, n-1);
    }

    Feature.find({
      "where": {
        "blockId": blockId,
        "parentId": null
      },
      'include': include_n_level_features({}, depth)
    }, options).then(function(features) {
      return process.nextTick(() => cb(null, features));
    });
  };

  /**
   * @param data contains :
   * @param dnaSequence FASTA format for Blast; text string input for other searchType-s, e.g. string "actg..."
   * @param parent  datasetId of parent / reference of the blast db which is to be searched
   * @param searchType 'blast'
   * @param resultRows
   * @param addDataset
   * @param datasetName
   * @param minLengthOfHit, minPercentIdentity, minPercentCoverage : minimum values to filter results
   * @param options
   *
   * @param cb node response callback
   */
  Feature.dnaSequenceSearch = function(data, options, cb) {
    const models = this.app.models;

    let {dnaSequence, parent, searchType, resultRows, addDataset, datasetName,
         minLengthOfHit, minPercentIdentity, minPercentCoverage
        } = data;
    // data.options : params for streaming result, used later.
    const fnName = 'dnaSequenceSearch';
    /** each user session may have 1 concurrent dnaSequenceSearch.
     * Use session id for a unique index for dnaSequence fileName.  */
    let index = sessionIndex(options.accessToken.id),
        queryStringFileName = 'dnaSequence.' + index + '.fasta';
    console.log(fnName, dnaSequence.length, parent, searchType, index, queryStringFileName);

    /** Receive the results from the Blast.
     * @param chunk is a Buffer
     * null / undefined indicates child process closed with status 0 (OK) and sent no output.
     * @param cb is cbWrap of cb passed to dnaSequenceSearch().
     */
    let searchDataOut = (chunk, cb) => {
      if (! chunk) {
        cb(null, []);
      } else
      if (chunk.asciiSlice(0,6) === 'Error:') {
        cb(new Error(chunk.toString()));
      } else {
        const
        textLines = chunk.toString().split('\n')
          .filter((textLine) => filterBlastResults(
            minLengthOfHit, minPercentIdentity, minPercentCoverage, textLine));
        textLines.forEach((textLine) => {
          if (textLine !== "") {
            console.log(fnName, 'stdout data',  "'", textLine,  "'");
          }
        });
        if (addDataset) {
          let jsonFile='tmp/' + datasetName + '.json';
          /** same as convertSearchResults2Json() in dnaSequenceSearch.bash */
          let datasetNameFull=`${parent}.${datasetName}`;
          console.log('before removeExisting "', datasetNameFull, '"', '"', jsonFile, '"');
          upload.removeExisting(models, datasetNameFull, /*replaceDataset*/true, cb, loadAfterDelete);

          function loadAfterDelete(err) {
            upload.loadAfterDeleteCb(
              jsonFile, 
              (jsonData) => 
                upload.uploadParsedTryCb(models, jsonData, options, cb), 
              err, cb);
          }

        }

        cb(null, textLines);
      }
    };

    if (true) {
    let child = childProcess(
      'dnaSequenceSearch.bash',
      dnaSequence, true, queryStringFileName, [parent, searchType, resultRows, addDataset, datasetName], searchDataOut, cb, /*progressive*/ false);
    } else {
      let features = dev_blastResult;
      cb(null, features);
    }
  };


  Feature.remoteMethod('search', {
    accepts: [
      {arg: 'filter', type: 'array', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {arg: 'features', type: 'array'},
    description: "Returns features and their datasets given an array of feature names"
  });

  Feature.remoteMethod('depthSearch', {
    accepts: [
      {arg: 'blockId', type: 'string', required: true},
      {arg: 'depth', type: 'number', required: true},
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    http: {verb: 'get'},
    returns: {arg: 'features', type: 'array'},
    description: "Returns features by their level in the feature hierarchy"
  });
 
  Feature.remoteMethod('dnaSequenceSearch', {
    accepts: [
      {arg: 'data', type: 'object', required: true, http: {source: 'body'}},
      /* Within data : .dnaSequence, and :
      {arg: 'parent', type: 'string', required: true},
      {arg: 'searchType', type: 'string', required: true},
      resultRows, addDataset, datasetName
      */
      {arg: "options", type: "object", http: "optionsFromRequest"}
    ],
    // http: {verb: 'post'},
    returns: {arg: 'features', type: 'array'},
    description: "DNA Sequence Search e.g. Blast, returns TSV output as text array"
  });
 
  acl.assignRulesRecord(Feature)
  acl.limitRemoteMethods(Feature)
  acl.limitRemoteMethodsSubrecord(Feature)
  acl.limitRemoteMethodsRelated(Feature)
};

/*----------------------------------------------------------------------------*/

const dev_blastResult = [
  "BobWhite_c10015_641     chr2A   100.000 50      0       0       1       50      154414057       154414008       2.36e-17        93.5    50      780798557",
  "BobWhite_c10015_641     chr2B   98.000  50      1       0       1       50      207600007       207600056       1.10e-15        87.9    50      801256715"
];
/*----------------------------------------------------------------------------*/

