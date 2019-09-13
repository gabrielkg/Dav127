import Ember from 'ember';
import Service from '@ember/service';
import { task } from 'ember-concurrency';

const { inject: { service } } = Ember;

import { stacks } from '../../utils/stacks';


let trace_block = 1;

/** Augment the store blocks with features to support mapview.
 * In particular, add an `isViewed` attribute to blocks, which indicates that
 * the block is viewed in the mapview.
 *
 *  It is possible that later there will be multiple mapviews in one route, in
 *  which case the isViewed state might be split out of this singleton service,
 *  or this may become a per-mapview component.
 * 
 */
export default Service.extend(Ember.Evented, {
    auth: service('auth'),
    store: service(),

  injectParsedOptions(parsedOptions) {
    this.set('parsedOptions', parsedOptions);
  },

  /** Not required because findRecord() is used;
   * might later want this for other requests or calculation results, but can
   * discard it.
   */
  push : function (id, block) {
    console.log('block push', block);
    let pushData = 
      {
        data: {
          id: id,
          type: 'block',
          attributes: block
        }
      };
    // silently fails to return
    this.get('store').push(pushData);
  },

  /*--------------------------------------------------------------------------*/


  /** Call getData() in a task - yield the block result.
   * Signal that receipt with receivedBlock(id, block).
   */
  taskGet: task(function * (id) {
    /** if not already loaded and viewed, then trigger receivedBlock */
    let isViewed = this.get('getIsViewed').apply(this, [id]);
    let block = yield this.getData(id);
    // console.log('taskGet', this, id, block);
    if (! isViewed)
    {
      block.set('isViewed', true);
      this.trigger('receivedBlock', [{id, obj : block}]);
    }
    return block;
  }),
  getData: function (id) {
    // console.log("block getData", id);
    let store = this.get('store');
    let allInitially = this.get('parsedOptions.allInitially');
    let options = 
      { reload: true};
    if (allInitially)
      options.adapterOptions = 
        {
          filter: {include: "features"}
        };
    let blockP = store.findRecord(
      'block', id,
      options
    );

    return blockP;
  }  // allow multiple in parallel - assume id-s are different
  // later can use ember-contextual-service to give each id its own task scheduler
  ,

  /*--------------------------------------------------------------------------*/

  /** Call getSummary() in a task - yield the block result.
   * Signal that receipt with receivedBlock([{id, obj:block}]).
   */
  taskGetSummary: task(function * (blockIds) {
    let blockFeatureCounts = yield this.getSummary(blockIds);
    console.log('taskGetSummary', this, blockIds, blockFeatureCounts);
    blockFeatureCounts.forEach((bfc) => {
      let block = this.peekBlock(bfc._id);
      if (! block)
        console.log('taskGetSummary', bfc._id);
      else
        block.set('featureCount', bfc.featureCount);
    });
    let blocksToView = this.blocksReferences(blockIds);
    this.viewReferences(blocksToView);
    this.receivedBlocks(blocksToView);
    
    return blockFeatureCounts;
  }),
  /** @return the reference blocks corresponding to the given blockIds.
   * Result form is an array of {id : blockId, obj : block}.
   * If a block is its own reference (GM) it is not included in the result.
   * later : suppress duplicates.
   */
  blocksReferences(blockIds) {
    /* blockFeatureCounts will omit reference blocks since they have no features,
     * so use blockIds to set viewed and trigger receivedBlock.
     */
    let blocksToView =
      blockIds.reduce((result, blockId) => {
        let block = this.peekBlock(blockId);
        if (! block)
          console.log('taskGetSummary', blockId);
        else {
          let referenceBlock = block.get('referenceBlock');
          if (referenceBlock && (referenceBlock !== block)) {
            result.push({id : referenceBlock.get('id'), obj : referenceBlock});
          }
          result.push({id : blockId, obj : block});
        }
        return result;
      }, []);
    return blocksToView;
  },
  viewReferences(blocksToView) {
    Ember.changeProperties(function() {
      blocksToView.forEach(function(b) {
        b.obj.set('isViewed', true);
        console.log('taskGetSummary changeProperties isViewed', b.obj.get('id'));
      });
    });
  },
  receivedBlocks(blocksToView) {
    /** trigger receivedBlock() for the requested blocks and their parents.
     *
     * Event triggers are immediate, growing the stack and possibly creating
     * recursion, whereas ComputedProperty-s are evaluated in a batch within
     * the run-loop cycle.  So this event trigger is likely to be transitioned
     * to a ComputedProperty dependency.
     * This concern is ameliorated by using a single trigger for all of the
     * blocksIds, omitting those already viewed, and including their referenceBlock-s.
     */
    this.trigger('receivedBlock', blocksToView);
  },
  getSummary: function (blockIds) {
    // console.log("block getSummary", id);
    let blockP =
      this.get('auth').getBlockFeaturesCount(blockIds, /*options*/{});
    return blockP;
  },

  /*--------------------------------------------------------------------------*/

  /** @return the block record handle if the block is loaded into the store from the backend.
   */
  peekBlock(blockId)
  {
    let store = this.get('store'),
    block = store.peekRecord('block', blockId);
    return block;
  },

  /*--------------------------------------------------------------------------*/

  /** @return true if the block is loaded into the store from the backend, and has .isViewed==true.
   */
  getIsViewed(blockId)
  {
    let store = this.get('store'),
    block = store.peekRecord('block', blockId),
    isViewed = block && block.get('isViewed');
    return isViewed;
  },

  /*--------------------------------------------------------------------------*/

  /**
   * The GUI does not provide a way for the user to unview a block which is not currently loaded.
   *
   * alternative implementation : mixins/viewed-blocks.js : @see setViewed()
   *
   * If viewed && unviewChildren && this block doesn't have .namespace then
   * search the loaded blocks for blocks which reference the block being
   * unviewed, and mark them as unviewed also.
   * @param unviewChildren
   *
   * @return define a task
   */
  setViewedTask: task(function * (id, viewed, unviewChildren) {
    console.log("setViewedTask", id, viewed, unviewChildren);
    let getData = this.get('getData');
    /* -  if ! viewed then no need to getData(), just Peek and if not loaded then return.
     * The GUI only enables viewed==false when block is loaded, so that difference is moot.
     */
    let block = yield getData.apply(this, [id]);
    console.log('setViewedTask', this, id, block);
    if (block.get('isViewed') && ! viewed && unviewChildren)
    {
      let maybeUnview = this.get('loadedViewedChildBlocks'),
      isChildOf = this.get('isChildOf'),
      toUnview = maybeUnview.filter(function (dataBlock) {
        return isChildOf(dataBlock, block);
      });
      console.log('setViewedTask', /*maybeUnview,*/ toUnview
                  .map(function(blockR) { return blockR.view.longName(); }) );
      toUnview.forEach(function (childBlock) {
        childBlock.set('isViewed', viewed);
      });
    }
    block.set('isViewed', viewed);
    // this.trigger('receivedBlock', id, block);  // not required now ?
  }),

  /** @return true if dataBlock is a child of block.
   * i.e. dataBlock.dataset.parent.id == block.dataset.id
   * and dataBlock.scope == block.scope
   */
  isChildOf(dataBlock, block) {
    let d = block.get('id'), d2 = dataBlock.get('id'), a = dataBlock,
    dataset = block.get('datasetId'), ad = dataBlock.get('datasetId');
    let match = 
      (d != d2) &&  // not self
      /* ! a.parent &&*/
      ad && (ad.get('parent').get('id') === dataset.get('id')) &&
      (dataBlock.get('scope') == block.get('scope'));
    if (trace_block > 1)
      console.log(
        'isChildOf', match, dataBlock, block, d, d2, dataset, ad, 
        dataBlock.get('scope'), block.get('scope'),
        dataBlock.view.longName(), block.view.longName()
    );
    return match;
  },

  /*--------------------------------------------------------------------------*/

  getBlocks(blockIds) {
    let taskGet = this.get('taskGet');
    console.log("getBlocks", blockIds);
    let blockTasks = blockIds.map(
      function (id) {
        let blockTask = taskGet.perform(id);
        console.log("mapview model", id, blockTask);
        return blockTask;
      });

    console.log("getBlocks() result blockTasks", blockTasks);
    return blockTasks;
  },

  getBlocksSummary(blockIds) {
    let taskGet = this.get('taskGetSummary');
    console.log("getBlocksSummary", blockIds);
    let blocksTask = taskGet.perform(blockIds);
    console.log("getBlocksSummary() result blocksTask", blocksTask);
    return blocksTask;
  },


  /*--------------------------------------------------------------------------*/


  /** @return block records */
  blockValues: Ember.computed(function() {
    let records = this.get('store').peekAll('block');
    if (trace_block)
      console.log('blockValues', records);
    return records;
  }),
  selected: Ember.computed(
    'blockValues.@each.isSelected',
    function() {
      let records = this.get('blockValues')
        .filterBy('isSelected', true);
      if (trace_block)
        console.log('selected', records);
      return records;  // .toArray()
    }),
  viewed: Ember.computed(
    'blockValues.[]',
    'blockValues.@each.isViewed',
    function() {
      let records = this.get('store').peekAll('block') // this.get('blockValues')
        .filterBy('isViewed', true);
      if (trace_block)
        console.log('viewed', records.toArray());
      // can separate this to an added CP viewedEffect
      let axes = records.map((block) => this.blockAxis(block));
      console.log('viewed axes', axes);
      return records;  // .toArray()
    }),
  viewedIds: Ember.computed(
    'blockValues.[]',
    'blockValues.@each.isViewed',
    'viewed.[]',
    function() {
      let ids = this.get('viewed');
      if (trace_block > 1)
        ids.map(function (a) { console.log('viewedIds', a, a.get('id')); } );
      if (trace_block)
        console.log('viewedIds', ids);
      ids = ids.map(function (a) { return a.get('id'); } );
      if (trace_block)
        console.log('viewedIds', ids);

      return ids;
    })
  ,
  viewedScopes: Ember.computed(
    'viewed.[]',
    function() {
      let records = this.get('viewed');
      if (trace_block > 1)
        records.map(function (a) { console.log('viewedScopes', a, a.get('scope')); } );
      if (trace_block)
        console.log('viewedScopes', records);
      let scopes = records.reduce(function (result, a) { let scope = a.get('scope'); return result.add(scope); }, new Set() );
      scopes = Array.from(scopes);
      if (trace_block)
        console.log('viewedScopes', scopes);

      return scopes;
    }),

  /** Return (a promise of) the viewed blocks which contain a numeric value for
   * each feature, in addition to the feature position.
   * These are suited to be rendered by axis-chart.
   */
  viewedChartable: Ember.computed(
    'viewed.[]',
    function() {
      let records =
        this.get('viewed')
        .filter(function (block) {
          let tags = block.get('datasetId.tags'),
          line = block.get('isChartable');
          if (line)
            console.log('viewedChartable', tags, block);
          return line;
        });
      if (trace_block > 1)
        console.log(
          'viewedChartable', records
            .map(function(blockR) { return blockR.view.longName(); })
        );
      return records;  // .toArray()
    }),

  /*----------------------------------------------------------------------------*/


  /** Search for the named features, and return also their blocks and datasets.
   */
  getBlocksOfFeatures : task(function* (featureNames) {
    let me = this, blocks =
      yield this.get('auth').featureSearch(featureNames, /*options*/{});

    return blocks;
  }),



  /** From the list of viewed loaded blocks, filter out those which are not data
   * blocks.
   * @return array of blocks
   */
  loadedViewedChildBlocks: Ember.computed(
    'viewed.[]',
    'blockValues.@each.{isViewed,isLoaded}',
    function() {
      let records =
        this.get('viewed')
        .filter(function (block) {
          // hasFeatures indicates isData.
          return block.get('isLoaded') // i.e. !== undefined
            && block.get('hasFeatures');
        });
      if (trace_block > 1)
        console.log(
          'loadedViewedChildBlocks', records
            .map(function(blockR) { return blockR.view && blockR.view.longName(); })
        );
      return records;  // .toArray()
    }),

  /** @return Map of axes to loaded viewed child blocks */
  axesBlocks : Ember.computed(
    'loadedViewedChildBlocks.[]',
    function () {
      let records = this.get('loadedViewedChildBlocks'),
      map = records.reduce(
        (map, block) => {
          let axis = this.blockAxis(block);
          if (axis) {
            let blocks = map.get(axis);
            if (! blocks)
              map.set(axis, blocks = []);
            blocks.push(block);
          }
          return map; },
        new Map()
      );

      console.log('axesBlocks', map);
      return map;
    }),
  /** Lookup the axis of block, and if none then use ensureAxis().
   */
  blockAxis(block) {
    let axis = block.get('axis');
    if (! axis) {
      this.ensureAxis(block);
      axis = block.get('axis');
      console.log('blockAxis', axis);
    }
    return axis;
  },
  /** Call axisApi.ensureAxis() for block. */
  ensureAxis(block) {
    /* stacks-view will map URL params configuring stacks for viewed blocks to
     * rendered DOM elements with associated Stack .__data and these 2 functions
     * (blockAxis and ensureAxis) can be absorbed into that.
     */
    let oa = stacks.oa, axisApi = oa.axisApi;
    axisApi.cmNameAdd(oa, block);
    console.log('ensureAxis', block.get('id'));
    axisApi.ensureAxis(block.get('id'));
    stacks.forEach(function(s){s.log();});
  },
  /** Collate the viewed blocks by their parent block id, or by their own block
   * id if they are not parented.
   * @return Map : blockId -> [blockId]
   * @description
   * Similar to @see axesBlocks().
   */
  dataBlocks : Ember.computed(
    'loadedViewedChildBlocks.[]',
    'loadedViewedChildBlocks.@each.hasFeatures',
    function () {
      let records = this.get('loadedViewedChildBlocks'),
      map = records.reduce(
        function (map, block) {
          let referenceBlock = block.get('referenceBlock'),
           id = referenceBlock ? referenceBlock.get('id') : block.get('id');
          if (! id)
            console.log('dataBlocks', block.id, referenceBlock);
          else {
            let blocks = map.get(id);
            if (! blocks)
              map.set(id, blocks = []);
            /* non-data (reference) blocks are map indexes, but are not put in
             * the dataBlocks array. */
            if (block.get('hasFeatures'))
              blocks.push(block);
          }
          return map; },
        new Map()
      );

      console.log('dataBlocks', map);
      return map;
    })

});
