import { breakPoint } from '../utils/breakPoint';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** Copy fields from a chromosome (block) Ember DS object.
 * @param c chromosome (block) object in the Ember data store
 */
function copyChrData(c) {
  let 
    map = c.get('datasetId'),  // replaces c.get('map'),
  /* rc aka retHash[chr] */
  rc  = {mapName : map.get('name'), chrName : c.get('name')
         /* , scope : c.get('scope'), featureType : c.get('featureType')
         , namespace: map.namespace, */ , dataset : map
        };
  ['range', 'featureType', 'scope'].forEach(function (fieldName) {
  if (c.get(fieldName))
    rc[fieldName] = c.get(fieldName);
  });

  return rc;
}

/** bundle chr data (incl features) for draw-map:draw().
 * copy of Ember.RSVP.hash(promises).then(); factor these together.
 * @param c aka chrs[chr]
 */
function chrData(c) {
  /* factored from controllers/mapview.js, where it was originally developed. */

  let rc = copyChrData(c),
  map = rc.map;

  let f = c.get('features');
  f.forEach(function(feature) {
    let featureName = feature.get('name');
    /** range should be defined and be an array, but this will handle a mix of
     * data from other source versions without exception.
     *
     * Also field name is changing feature.range <-> .value
     * Current data is mixed format  :
     * from pretzel-data [develop] : myMap.json has value [0, 0] and 
     * public_maps/json/pbi0012-0787-SD23.fixed.json has range [0]
     *
     * Compare against undefined, because 0 is a valid value.
     */
    let value = feature.get('value'), range = feature.get('range'),
    value0 = (value && value.length ? value[0] : value),
    featurePosition = (value0 !== undefined) ? value0 : range && range[0];
    let featureAliases = feature.get('aliases');  // feature.aliases field is removed from db
    let featureId = feature.get('id');
    if (featurePosition === undefined)
      breakPoint('chrData', c, map, rc, f, feature, range, featurePosition, featureAliases, featureId);
    rc[featureName] = {location: featurePosition, aliases: featureAliases, id: featureId};
    // if (!range) console.log("chrData range", featureName, rc[featureName]);
  });
  dLog("chrData", rc);
  return rc;
}

/*----------------------------------------------------------------------------*/

/** Support some data structures which are wrappers around Ember store data :
 * cmName and mapChr2Axis.
 *
 * There is some value in being framework-independent, which these data
 * structures (and z etc) offer, but the advantages of integrating more fully with
 * Ember, e.g. ComputedProperty-s, make it worthwhile.
 * So these data structures can be progressively replaced via the strangler fig
 * model (as described by Martin Fowler, https://www.martinfowler.com/bliki/StranglerApplication.html).
 */
function cmNameAdd(oa, block) {
  let
    axis = block.get('id'),
    cmName = oa.cmName,
  mapChr2Axis = oa.mapChr2Axis,
  c = copyChrData(block);
  /* Based on draw-map.js:receiveChr() */

  let dataset = c.dataset,
  datasetName = dataset && dataset.get('name'),
  parent = dataset && dataset.get('parent'),
  parentName = parent  && parent.get('name')
  ;
  // oa.datasets[] seems unused.
  if (oa.datasets[datasetName] === undefined)
  {
    oa.datasets[datasetName] = dataset;
    dLog(datasetName, dataset.get('_meta.shortName'));
  }

  cmName[axis] = {mapName : c.mapName, chrName : c.chrName
                  , parent: parentName
                  , name : c.name, range : c.range
                  , scope: c.scope, featureType: c.featureType
                  , dataset : dataset
                 };

  let mapChrName = oa.axisApi.makeMapChrName(c.mapName, c.chrName);
  mapChr2Axis[mapChrName] = axis;

  oa.axisApi.axisIDAdd(axis);
}
/*----------------------------------------------------------------------------*/

export { chrData, cmNameAdd };
