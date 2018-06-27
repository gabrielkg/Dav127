import Ember from 'ember';
import compileSearch from 'npm:binary-search-bounds';
console.log("compileSearch", compileSearch);
import createIntervalTree from 'npm:interval-tree-1d';
console.log("createIntervalTree", createIntervalTree);
const { inject: { service } } = Ember;


/*----------------------------------------------------------------------------*/

import { EventedListener } from '../utils/eventedListener';
import { chrData } from '../utils/utility-chromosome';
import { eltWidthResizable, noShiftKeyfilter, eltClassName  } from '../utils/domElements';
import { /*fromSelectionArray,*/ logSelectionLevel, logSelection, logSelectionNodes, selectImmediateChildNodes } from '../utils/log-selection';
import { Viewport } from '../utils/draw/viewport';
import {  Axes, maybeFlip, maybeFlipExtent,
          /*yAxisTextScale,*/  yAxisTicksScale,  yAxisBtnScale, eltId, axisEltId  }  from '../utils/draw/axis';
import { stacksAxesDomVerify  }  from '../utils/draw/stacksAxes';
import { Block, Stacked, Stack, stacks, xScaleExtend, axisRedrawText } from '../utils/stacks';
import { updateRange } from '../utils/stacksLayout';
import {DragTransition, dragTransitionTime, dragTransitionNew, dragTransition } from '../utils/stacks-drag';
import { round_2, checkIsNumber} from '../utils/domCalcs';
import { Object_filter } from '../utils/Object_filter';
import { name_chromosome_block, name_position_range, isOtherField } from '../utils/field_names';
import { breakPoint, breakPointEnableSet } from '../utils/breakPoint';
import { highlightFeature_drawFromParams } from './draw/highlight-feature';

/*----------------------------------------------------------------------------*/

/* jshint curly : false */

/* these warnings are sometimes useful, but they are causing "Too many errors. (89% scanned)." */
/* jshint -W087 */
/* jshint -W032 */
/* jshint -W116 */
/* jshint -W098 */
/* jshint -W014  */
/* jshint -W030 */
/* jshint -W083 */

/*global d3 */

/*----------------------------------------------------------------------------*/

let trace_dataflow = 1;


Object.filter = Object_filter;


let flowButtonsSel = "div.drawing-controls > div.flowButtons";

/*----------------------------------------------------------------------------*/

function configurejQueryTooltip(oa, node) {
  d3.selectAll(node + " > div.flowButton")
    .each(function (flowName) {
      // console.log("configurejQueryTooltip", flowName, this, this.outerHTML);
      let node_ = this;
      Ember.$(node_)
      /*
        .tooltip({
          template: '<div class="tooltip" role="tooltip">'
            + '<div class="tooltip-arrow"></div>'
            + '<div class="tooltip-inner"></div>'
            + '</div>',
          title: "title" + flowName
        })
       */
      /* Either 1. show when shift-click, or 2. when hover
       * For 1, un-comment this on(click) and popover(show), and comment out trigger & sticky.
        .on('click', function (event) {
          console.log(event.originalEvent.type, event.originalEvent.which, event);
          // right-click : event.originalEvent.which === 3
          if (event.originalEvent.shiftKey)
            Ember.$(event.target)
       */
        .popover({
          trigger : "hover",
          sticky: true,
          delay: {show: 200, hide: 3000},
          placement : "auto bottom",
          title : flowName,
          html: true,
          /* Possibly some variation between jQuery function .tooltip() and
           * bootstrap popover (used here) : may take parameter template in
           * place of content.
           * This is using : bower_components/bootstrap/js/popover.js, via bower.json
           */
          content : ""
            + '<button class="ExportFlowData" id="Export:' + flowName + '" href="#">Export</button>'
          /*
           })
           .popover("show")
           ;
           */
        })
        .on("shown.bs.popover", function(event) {
          console.log("shown.bs.popover", "Export", event, event.target);
          let exportButtonS = d3.select("button.ExportFlowData");
          console.log(exportButtonS.empty(), exportButtonS.node());
          exportButtonS
            .on('click', function (buttonElt /*, i, g*/) {
              console.log("Export", flowName, this);
              let flow = oa.flows[flowName];
              // output flow name and data to div.pathDataTable
              flow.ExportDataToDiv("div.ExportFlowData");
            });
        });
    });
};


let
      axisTitle_colour_scale = d3.scaleOrdinal();
      axisTitle_colour_scale.range(d3.schemeCategory10);




export default Ember.Component.extend(Ember.Evented, {
  classNames: ['draw-map-container'],

  store: Ember.inject.service('store'),
  blockService: service('data/block'),


  /*------------------------------------------------------------------------*/
//-  graphData: Ember.inject.service('graph-data'),
  /*------------------------------------------------------------------------*/

  drawActionsListen: function(listen, name, target, method) {
    /** drawActions is an action&event bus specific to one draw-map; it is a reference
     * to mapview (see map-view.hbs) but could be owned by the draw-map. */
    let drawActions = this.get('drawActions'); 
    console.log("drawActionsListen", listen, drawActions, this);
    if (drawActions === undefined)
      console.log('parent component drawActions not passed', this);
    else
    {
      // let onOff = listen ? drawActions.on : drawActions.off;
        if (listen)
          drawActions.on(name, target, method);
        else
          drawActions.off(name, target, method);
      }
  },

  drawControlsListen(listen)
  {
    this.drawActionsListen(listen, 'drawControlsLife', this, this.drawControlsLife);
  },
  /** handle life-cycle events (didInsertElement, willDestroyElement) from draw-controls. */
   drawControlsLife : function(start) {
     console.log("drawControlsLife in components/draw-map (drawActions)", start);
     if (this.drawControlsLifeC)
       this.drawControlsLifeC(start);
   },
 
  /** Listen for actions from sub-components of draw-map.
   * Both mapview and draw-map component are Evented, and are used as event buses
   * for components defined within their templates.
   *
   * Also  @see drawActionsListen(), drawControlsListen(), which connect to the mapview event bus.
   * Based on components/goto-features createListener().
   */
  createListener(bus) {
    if (bus === undefined)
      console.log('Evented component not passed', bus);
    else
      this.set('listener', new EventedListener(
        bus,
        [{name: 'stackPositionsChanged', target: this, method: this.stackPositionsChanged}]
      ));
  },

  /** listen to events sent by sub-components.
   * Called when init and willDestroyElement. */
  localBus : function (listen) {
    if (listen && this.get('listener') === undefined)
    {
      let oa = this.get('oa');

      /* oa.eventBus is used in stacks to send updatedStacks and stackPositionsChanged; 
       * perhaps change ownership of those events to a stacks Evented component. */
      let bus =
      oa.eventBus = this;
      if (this.get('listener') === undefined)
        this.createListener(bus);
    }
    if (this.listener)
      this.listener.listen(listen);
  },

  /*------------------------------------------------------------------------*/

  /** Used for receiving colouredFeatures from selected-features.js,
   * and flipRegion, ...
   */
  feedService: (console.log("feedService"), Ember.inject.service('feed')),

    /** these actions on feedService can be moved to drawActions;
     * feedService is global, whereas drawActions is specific to a single draw-map;
     * currently there is only one draw-map, but having multiple draw-maps in
     * one browser tab would be useful.
     */
  listen: function() {
    let f = this.get('feedService');
    console.log("listen", f);
    if (f === undefined)
    {
      console.log('listen() : feedService undefined', this);
      breakPoint();
    }
    else {
      f.on('colouredFeatures', this, 'updateColouredFeatures');
      f.on('clearScaffoldColours', this, 'clearScaffoldColours');
      f.on('flipRegion', this, 'flipRegion');
      f.on('resetZooms', this, 'resetZooms');
    }

    this.drawControlsListen(true);
    this.localBus(true);
    let blockService = this.get('blockService');
    blockService.on('receivedBlock', this, 'receivedBlock');
  }.on('init'),

/** addPathsToCollation() is in draw closure, otherwise would register it here
  willInsertElement : function () {
    console.log("components/draw-map willInsertElement");
    this._super(...arguments);
    this.on('paths', this.addPathsToCollation);
  },
*/

  // remove the binding created in listen() above, upon component destruction
  cleanup: function() {
    let f = this.get('feedService');
    f.off('colouredFeatures', this, 'updateColouredFeatures');
    f.off('clearScaffoldColours', this, 'clearScaffoldColours');
    f.off('flipRegion', this, 'flipRegion');
    f.off('resetZooms', this, 'resetZooms');

    this.drawControlsListen(false);
    this.localBus(false);

    this.off('paths');

    let blockService = this.get('blockService');
    blockService.off('receivedBlock', this, 'receivedBlock');

  }.on('willDestroyElement'),

//{
  /** undefined, or a function to call when colouredFeatures are received  */
  colouredFeaturesChanged : undefined,

  updateColouredFeatures: function(features) {
    console.log("updateColouredFeatures in components/draw-map.js");
    let self = this;
    this.get('scroller').scrollVertical('#holder', {
      duration : 1000,
      // easing : 'linear', // default is swing
      offset : -60
    }).then(function () {
      let colouredFeaturesChanged = self.get('colouredFeaturesChanged');
      if (colouredFeaturesChanged)
        colouredFeaturesChanged(features);
    });
  },

  draw_flipRegion : undefined,
  flipRegion: function(features) {
    console.log("flipRegion in components/draw-map.js");
    let flipRegion = this.get('draw_flipRegion');
    if (flipRegion)
      flipRegion(features);
  },
//}

  /*------------------------------------------------------------------------*/
  
  scroller: Ember.inject.service(),

  /** later axes can be all displayed axes, but in this first stage:  just add them when they are extended */
  axes2d : [],
  splitAxes: Ember.computed.filterBy('axes2d', 'extended', true),

  axisData : [{feature: "A1", position: 11}, {feature: "A2", position: 12}],

  /*------------------------------------------------------------------------*/

  actions: {
//-	?
    updatedSelectedFeatures: function(selectedFeatures) {
      let featuresAsArray = d3.keys(selectedFeatures)
        .map(function (key) {
          return selectedFeatures[key].map(function(feature) {
            //feature contains feature name and position, separated by " ".
            var info = feature.split(" ");
            return {Chromosome:key,Feature:info[0],Position:info[1]};
          });
        })
        .reduce(function(a, b) { 
          return a.concat(b);
        }, []);
      // console.log(featuresAsArray);
      console.log("updatedSelectedFeatures in draw-map component",
                  selectedFeatures, featuresAsArray.length);
      this.sendAction('updatedSelectedFeatures', featuresAsArray);
    },

    selectChromById : function (brushedAxisID) {
      this.sendAction('selectChromById', brushedAxisID);
    },

    updatedStacks: function(stacks) {
      let stacksText = stacks.toString();
      // stacks.log();
      console.log("updatedStacks in draw-map component");
    },

    stackPositionsChanged : function(stack) {
      console.log("stackPositionsChanged in components/draw-map (drawActions)", stack);
      let oa = this.get('oa');  // , stack = oa.stacks[stackID];
      // console.log(oa.stacks, stack);
      stack.axes.forEach(
        function (a, index)
        {
          updateRange(oa.y, oa.ys, oa.vc, a);
        });
    },

    addMap : function(mapName) {
      console.log("controller/draw-map", "addMap", mapName);
      this.sendAction('addMap', mapName);
    },
    mapsToViewDelete : function(mapName) {
      console.log("controller/draw-map", "mapsToViewDelete", mapName);
      this.sendAction('mapsToViewDelete', mapName);
    },

    enableAxis2D: function(axisID, enabled) {
      let axes2d = this.get('axes2d');
      let axis = axes2d.findBy('axisID', axisID);
      if (axis === undefined)
      {
        axis = Ember.Object.create({ axisID : axisID });
        axes2d.pushObject(axis);
        console.log("create", axisID, axis, "in", axes2d);
      }
      console.log("enableAxis2D in components/draw-map", axisID, enabled, axis);
        axis.set('extended', enabled);  // was axis2DEnabled
      console.log("splitAxes", this.get('splitAxes'));
      console.log("axes2d", this.get('axes2d'));
    },

    axisWidthResize : function(axisID, width, dx) {
      console.log("axisWidthResize in components/draw-map", axisID, width, dx);
      let axisWidthResize = this.get('axisWidthResize');
      if (axisWidthResize) axisWidthResize(axisID, width, dx);
    },
    axisWidthResizeEnded : function() {
      console.log("axisWidthResizeEnded in components/draw-map");
      let axisWidthResizeEnded = this.get('axisWidthResizeEnded');
      if (axisWidthResizeEnded) axisWidthResizeEnded();
    },

    resizeView : function()
    {
      console.log("resizeView()");
      // resize();
    }

  },

  /** set attribute name of this to value, if that is not the current value.
   * It is expected that value is not a complex type.
   */
  ensureValue : function(name, value)
  {
    if (this.get(name) != value)
      this.set(name, value);
  },

  /** object attributes */
  oa : {},

  /*------------------------------------------------------------------------------*/

  peekBlock : function(blockId) {
    let blockService = this.get('blockService');
    return blockService.peekBlock(blockId);
  },

  receivedBlock : function (id, block) {
    console.log('receivedBlock', this, id, block);
    // copied from dataObserver() (similar to drawPromisedChr()) - can simplify and rename ch -> block, chr -> blockId, 
    let
      ch = block,
    chr  = block.get('id'),
                    rc = chrData(ch);
                    /** Only 1 chr in hash, but use same structure as routes/mapview.js */
                    let retHash = {};
                    retHash[chr] = rc;
    this.get('receiveChr')(chr, rc, 'dataReceived');


    this.draw(retHash, 'dataReceived');
  },


  /** Draw the Axes (Axis Pieces) and the paths between them.
   * Axes are Axis Pieces; in this first stage they correspond to chromosomes,
   * but the plan is for them to represent other data topics and types.
   * Each Chromosome is a part of a genetic map in this application.
   *
   * @param myData array indexed by myAPs[*]; each value is a hash indexed by
   * <mapName>_<chromosomeName>, whose values are an array of features {location,
   * map:<mapName>_<chromosomeName>, feature: featureName}
   * The index value is referred to as axisName (axis - Axis Piece) for generality
   * (originally "mapName", but it actually identifies a chromosome within a map).
   *
   * @param myData hash indexed by axis names
   * @param source 'didRender' or 'dataReceived' indicating an added map.
   */
  draw: function(myData, source) {
    let myDataKeys;
    if (source === 'didRender')
    {
      myData = {};
    }
    myDataKeys = d3.keys(myData);
    console.log("draw()", myData, myDataKeys.length, source);

    // Draw functionality goes here.
    let me = this;

    let oa = this.get('oa');

    if (this.drawControlsLifeC === undefined)
    {
      console.log("set(drawControlsLife) (drawActions)", this, oa.stacks === undefined);
      /** It is sufficient to connect the graph drawing control panel life cycle
       * events to setupVariousControls() within the draw() closure, and it then
       * references other functions within that closure.
       * The individual controls can be factored out, e.g. creating an event API
       * for each control to deliver events from the component to the drawing.
       */
      this.set('drawControlsLifeC', function(start) {
        console.log("drawControlsLife in components/draw-map  (drawActions)", start);
        if (start)
          setupVariousControls();
      });

      /** currently have an instance of goto-feature in mapview.hbs (may remove
       * this - also have it via draw-map.hbs -> path-hover.hbs with data=oa ->
       * feature-name.hbs -> goto-feature ); this is just to get oa to that instance; not
       * ideal.  */
      let drawActions = this.get('drawActions'); 
      drawActions.trigger('drawObjectAttributes', this.get('oa')); // 
      console.log("draw() drawActions oa", drawActions, oa);

    this.on('paths', addPathsToCollation);
    }

    if (oa.showResize === undefined)
    {
      oa.showResize = showResize;
    }

  /*------------------------------------------------------------------------*/



    oa.stacks = stacks;
    stacks.init(oa);
    // stacks.axes[] is a mix of Stacked & Block; shouldn't be required & planning to retire it in these changes.
    oa.axes = stacks.axesP;
    oa.axesP = stacks.axesP;

    /** Reference to all datasets by name.
     * (datasets have no id, their child blocks' datasetId refers to their name) .
     * Not used yet.
     */
    let datasets = oa.datasets || (oa.datasets = {});
    /** Reference to all blocks by apName.
     * Not used yet.
    let blocks = oa.blocks || (oa.blocks = {});
     */



    /**  oa.axisIDs is an array, containing the block ID-s (i.e. chr names made
     *  unique by prepending their map name).
     * The array is not ordered; the stack order (left-to-right) is recorded by
     * the order of oa.stacks[].
     * This is all blocks, not just axesP (the parent / reference blocks).
     * @see service/data/blocks.js:viewed(), which can replace oa.axisIDs[].
     * @see stacks.axisIDs(), slight difference : blocks are added to
     * oa.axisIDs[] by receiveChr() before they are added to stacks;
     */
    console.log("oa.axisIDs", oa.axisIDs, source);
    /** axisIDs are <mapName>_<chromosomeName> */
    if ((source == 'dataReceived') || oa.axisIDs)
    {
      // append each element of myDataKeys[] to oa.axisIDs[] if not already present.
      // if (false)  // later limit it to axesP[], exclude blocks[]
      myDataKeys.forEach(function (axisID) { axisIDAdd(axisID); } );
    }
    else if ((myDataKeys.length > 0) || (oa.axisIDs === undefined))
      oa.axisIDs = myDataKeys;
    console.log("oa.axisIDs", oa.axisIDs);
    /** mapName (axisName) of each chromosome, indexed by chr name. */
    let cmName = oa.cmName || (oa.cmName = {});
    /** axis id of each chromosome, indexed by axis name. */
    let mapChr2Axis = oa.mapChr2Axis || (oa.mapChr2Axis = {});

    /** Plan for layout of stacked axes.

     graph : {chromosome{linkageGroup{}+}*}

     graph : >=0  chromosome-s layed out horizontally

     chromosome : >=1 linkageGroup-s layed out vertically:
     catenated, use all the space, split space equally by default,
     can adjust space assigned to each linkageGroup (thumb drag) 
     */



//- moved to utils/draw/viewport.js : Viewport(), viewPort, graphDim, dragLimit
    let vc = oa.vc || (oa.vc = new Viewport());
    if (vc.count < 2)
    {
      console.log(oa, vc);
      vc.count++;
      vc.calc(oa);
      if (vc.count > 1)
      {
        let
          widthChanged = oa.vc.viewPort.w != oa.vc.viewPortPrev.w,
        heightChanged = oa.vc.viewPort.h != oa.vc.viewPortPrev.h;
        if (oa.svgContainer)
          oa.showResize(widthChanged, heightChanged);
      }
      stacks.vc = vc; //- perhaps create vc earlier and pass vc to stacks.init()
    }
    let
      axisHeaderTextLen = vc.axisHeaderTextLen,
    margins = vc.margins,
    marginIndex = vc.marginIndex;
    let yRange = vc.yRange;
    let dragLimit = vc.dragLimit;
    let axisXRange = vc.axisXRange;

    if (oa.axes2d === undefined)
      oa.axes2d = new Axes(oa);

    let
      /** number of ticks in y axis when axis is not stacked.  reduce this
       * proportionately when axis is stacked. */
      axisTicks = 10,
    /** font-size of y axis ticks */
    axisFontSize = 12;
    /** default colour for paths; copied from app.css (.foreground path {
     * stroke: #808;}) so it can be returned from d3 stroke function.  Also
     * used currently to recognise features which are in colouredFeatures via
     * path_colour_scale(), which is a useful interim measure until scales are
     * set up for stroke-width of colouredFeatures, or better a class.
     */
    let pathColourDefault = "#808";

//- moved to utils/draw/viewport.js : xDropOutDistance_update()

    /** Draw paths between features on Axes even if one end of the path is outside the svg.
     * This was the behaviour of an earlier version of this Feature Map Viewer, and it
     * seems useful, especially with a transition, to show the progressive exclusion of
     * paths during zoom.n
     */
    let allowPathsOutsideZoom = false;

    /** When working with aliases: only show unique connections between features of adjacent Axes.
     * Features are unique within Axes, so this is always the case when there are no aliases.
     * Counting the connections (paths) between features based on aliases + direct connections,
     * if there is only 1 connection between a pair of features, i.e. the mapping between the Axes is 1:1,
     * then show the connection.
     *
     * Any truthy value of unique_1_1_mapping enables the above; special cases :
     * unique_1_1_mapping === 2 enables a basic form of uniqueness which is possibly not of interest
     * unique_1_1_mapping === 3 enables collateStacksA (asymmetric aliases).
     */
    let unique_1_1_mapping = 3;
    /** Include direct connections in U_alias, (affects collateStacks1():pathsUnique). */
    let directWithAliases = false;
    // let collateStacks = unique_1_1_mapping === 3 ? collateStacksA : collateStacks1;
    /** look at aliases in adjacent Axes both left and right (for unique_1_1_mapping = 3) */
    let adjacent_both_dir = true;
    /** A simple mechanism for selecting a small percentage of the
     * physical maps, which are inconveniently large for debugging.
     * This will be replaced by the ability to request subsections of
     * chromosomes in API requests.
     */
    const filter_location = false;
    /** true means the <path> datum is the text of the SVG line, otherwise it is
     * the "ffaa" data and the "d" attr is the text of the SVG line.
     * @see featureNameOfPath().
     */
    let pathDataIsLine;
    /** true means the path datum is not used - its corresponding data is held in its parent g
     */
    const pathDataInG = true;

    /** Apply colours to the paths according to their feature name (datum); repeating ordinal scale.
     * meaning of values :
     *  set path_colour_domain to
     *   1 : features
     *   2 : d3.keys(aliasGroup)
     *  colour according to input from colouredFeatures; just the listed featureNames is coloured :
     *  each line of featureNames is         domain is
     *   3: featureName                      featureName-s
     *   4: scaffoldName\tfeatureName        scaffoldName-s
     *      scaffoldName can be generalised as class name.
     */
    let use_path_colour_scale = 4;
    let path_colour_scale_domain_set = false;


//-	?
    /** export scaffolds and scaffoldFeatures for use in selected-features.hbs */
    let showScaffoldFeatures = this.get('showScaffoldFeatures');
    console.log("showScaffoldFeatures", showScaffoldFeatures);

    let showAsymmetricAliases = this.get('showAsymmetricAliases');
    console.log("showAsymmetricAliases", showAsymmetricAliases);

    /** Enable display of extra info in the path hover (@see hoverExtraText).
     * Currently a debugging / devel feature, will probably re-purpose to display metadata.
     */
    let showHoverExtraText = true;

    /** Used for d3 attributes whose value is the datum. */
    function I(d) { /* console.log(this, d); */ return d; };

    let svgContainer;

    let
      /** y[axisID] is the scale for axis axisID.
       * y[axisID] has range [0, yRange], i.e. as if the axis is not stacked.
       * g.axis-outer has a transform to position the axis within its stack, so this scale is used
       * for objects within g.axis-outer, and notably its child g.axis, such as the brush.
       * For objects in g.foreground, ys is the appropriate scale to use.
       */
      y = oa.y || (oa.y = {}),
    /** ys[axisID] is is the same as y[axisID], with added translation and scale
     * for the axis's current stacking (axis.position, axis.yOffset(), axis.portion).
     * See also comments for y re. the difference in uses of y and ys.
     */
    ys = oa.ys || (oa.ys = {}),
    /** scaled x value of each axis, indexed by axisIDs */
    o = oa.o || (oa.o = {}),
    /** Count features in Axes, to set stronger paths than normal when working
     * with small data sets during devel.  */
    featureTotal = 0,
    /** z[axisID] is a hash for axis axisID mapping feature name to location.
     * i.e. z[d.axis][d.feature] is the location of d.feature in d.axis.
     */
    z;  // was  = oa.z || (oa.z = myData);
    if (! oa.z)
      oa.z = myData;
    else  // merge myData into oa.z
      d3.keys(myData).forEach(function (blockId) {
        if (! oa.z[blockId])
          oa.z[blockId] = myData[blockId];
      });
    z = oa.z;

    /** All feature names.
     * Initially a Set (to determine unique names), then converted to an array.
     */
    if (oa.d3FeatureSet === undefined)
      oa.d3FeatureSet = new Set();

    /** Index of features (markers) by object id. the value refers to the marker hash,
     * i.e. z[chr/ap/block name][feature/marker name] === featureIndex[feature/marker id] */
    oa.featureIndex || (oa.featureIndex = []);

      if (source === 'didRender') {
        // when tasks are complete, receiveChr() is called via blockService : receivedBlock
      }
      else
        d3.keys(myData).forEach(function (axis) {
        /** axis is chr name */
      receiveChr(axis, myData[axis], source);
      });

    function redraw()
    {
      if (trace_dataflow > 1)
      {
        console.log("redraw", oa.axisIDs, oa.axes /*, oa.blocks*/);
        oa.stacks.log();
      }
      me.draw({}, 'dataReceived');
    }
    function receiveChr(axis, c, source) {
      let z = oa.z, cmName = oa.cmName;
      if ((z[axis] === undefined) || (cmName[axis] === undefined))
      {
        z[axis] = c;
        let dataset = c.dataset,
        datasetName = dataset && dataset.get('name'),
        parent = dataset && dataset.get('parent'),
        parentName = parent  && parent.get('name')
        ;
        if (oa.datasets[datasetName] === undefined)
        {
          oa.datasets[datasetName] = dataset;
        }
      cmName[axis] = {mapName : c.mapName, chrName : c.chrName
                    , parent: parentName
                    , name : c.name, range : c.range
                    , scope: c.scope, featureType: c.featureType
                   };
        
        let mapChrName = makeMapChrName(c.mapName, c.chrName);
      mapChr2Axis[mapChrName] = axis;
    //-	receive 'add axisIDs'
        if (source == 'dataReceived')
        {
          axisIDAdd(axis);
        }
      delete c.mapName;
      delete c.chrName;
      console.log("receiveChr", axis, cmName[axis]);
      d3.keys(c).forEach(function(feature) {
        if (! isOtherField[feature]) {
        let f = z[axis][feature];
        // alternate filter, suited to physical maps : f.location > 2000000
        if ((featureTotal++ & 0x3) && filter_location)
          delete z[axis][feature];
        else
        {
          oa.d3FeatureSet.add(feature);
          oa.featureIndex[f.id] = f;
          /* could partition featureIndex by block name/id :
           * oa.featureIndex[axis][f.id] = f; but not necessary because object id
           * is unique. */

          // featureTotal++;

          /** This implementation of aliases was used initially.
           * The feature is simply duplicated (same location, same axis) for each alias.
           * This works, but loses the distinction between direct connections (same feature / gene)
           * and indirect (via aliases).
           */
          if (! unique_1_1_mapping)
          {
            let featureValue = z[axis][feature];
            if (featureValue && featureValue.aliases)
              for (let a of featureValue.aliases)
            {
                z[axis][a] = {location: featureValue.location};
              }
          }
        }
        }
      });
      }
    }
    // hack a connection to receiveChr() until it gets moved / refactored.
    if (! this.get('receiveChr'))
      this.set('receiveChr', receiveChr);

    /** Check if axis exists in oa.axisIDs[].
     * @return index of axis in oa.axisIDs[], -1 if not found
     */
    function axisIDFind(axis) {
      let k;
      for (k=oa.axisIDs.length-1; (k>=0) && (oa.axisIDs[k] != axis); k--) { }
      return k;
    }
    /** If axis is not in oa.axisIDs[], then append it.
     * These 3 functions could be members of oa.axisIDs[] - maybe a class.
     */
    function axisIDAdd(axis) {
      if (axisIDFind(axis) < 0)
      {
        console.log("axisIDAdd push", oa.axisIDs, axis);
        oa.axisIDs.push(axis);
      }
    }
    /** Find axisName in oa.axisIDs, and remove it. */
    function deleteAxisfromAxisIDs(axisName)
    {
      let k = axisIDFind(axisName);
      if (k === -1)
        console.log("deleteAxisfromAxisIDs", "not found:", axisName);
      else
      {
        console.log("deleteAxisfromAxisIDs", axisName, k, oa.axisIDs);
        let a = oa.axisIDs.splice(k, 1);
        console.log(oa.axisIDs, "deleted:", a);
      }
    }

    //creates a new Array instance from an array-like or iterable object.
    let d3Features = Array.from(oa.d3FeatureSet);
    /** Indexed by featureName, value is a Set of Axes in which the feature is present.
     * Currently featureName-s are unique, present in just one axis (Chromosome),
     * but it seems likely that ambiguity will arise, e.g. 2 assemblies of the same Chromosome.
     * Terminology :
     *   genetic map contains chromosomes with features;
     *   physical map (pseudo-molecule) contains genes
     */
    let featureAxisSets = oa.featureAxisSets || (oa.featureAxisSets = {});

    if (oa.drawOptions === undefined)
    {
      oa.drawOptions =
      {
      /** true enables display of info when mouse hovers over a path.
       * A subsequent iteration will show reduced hover info in a fixed location below the graph when false.
       */
        showPathHover : false,
      /** true enables display of info when mouse hovers over a brushed feature position (marked with a circle) on an axis.
       * A subsequent iteration will show reduced hover info in a fixed location below the graph when false.
       */
      showCircleHover : false,
      /** Draw a horizontal notch at the feature location on the axis,
       * when the feature is not in a axis of an adjacent Stack.
       * Makes the feature location visible, because otherwise there is no path to indicate it.
       */
      showAll : true,
    /** Show brushed features, i.e. pass them to updatedSelectedFeatures().
     * The purpose is to save processing time; this is toggled by 
     * setupToggleShowSelectedFeatures() - #checkbox-toggleShowSelectedFeatures.
     */
    showSelectedFeatures : true
      };
    }

    /** Alias groups : aliasGroup[aliasGroupName] : [ feature ]    feature references axis and array of aliases */
    let aliasGroup = oa.aliasGroup || (oa.aliasGroup = {});


    /** Map from feature names to axis names.
     * Compiled by collateFeatureMap() from z[], which is compiled from d3Data.
     */
    let featureToAxis;
    /** Map from feature names to axis names, via aliases of the feature.
     * Compiled by collateFeatureMap() from z[], which is compiled from d3Data.
     */
    let featureAliasToAxis;

    // results of collateData()
    let
      /** axis / alias : feature    axisFeatureAliasToFeature[axis][feature alias] : [feature] */
      axisFeatureAliasToFeature = oa.axisFeatureAliasToFeature || (oa.axisFeatureAliasToFeature = {}),
    /** axis/feature : alias groups       axisFeatureAliasGroups[axis][feature] : aliasGroup
     * absorbed into z[axis][feature].aliasGroupName
     axisFeatureAliasGroups = {},  */
    // results of collateMagm() - not used
    /** feature alias groups Axes;  featureAliasGroupAxes[featureName] is [stackIndex, a0, a1] */
    featureAliasGroupAxes = {};

    /** class names assigned by colouredFeatures to alias groups, indexed by alias group name.
     * result of collateFeatureClasses().
     */
    let aliasGroupClasses = {};

    // results of collateStacks1()
    let
      /** feature : axis - axis    featureAxes[feature] : [[feature, feature]] */
      featureAxes = oa.featureAxes || (oa.featureAxes = {}),
    /** Not used yet; for pathAliasGroup().
     *  store : alias group : axis/feature - axis/feature   aliasGroupAxisFeatures[aliasGroup] : [feature, feature]  features have refn to parent axis
     * i.e. [aliasGroup] -> [feature0, a0, a1, za0[feature0], za1[feature0]] */
    aliasGroupAxisFeatures = {},
    /** path data in unique mode. [feature0, feature1, a0, a1] */
    pathsUnique;
    /** Paths - Unique, from Tree. */
    let put;

    /** results of collateAdjacentAxes() */
    let adjAxes = oa.adjAxes || (oa.adjAxes = {});
    /** results of collateStacksA() and from addPathsToCollation() */
    let aliased = {};
    let aliasedDone = {};

    let
      line = d3.line(),
      axis = d3.axisLeft(),
      foreground,
      // brushActives = [],
    /** guard against repeated drag event before previous dragged() has returned. */
    dragging = 0;
    /** trace scale of each axis just once after this is cleared.  enabled by trace_scale_y.  */
    let tracedAxisScale = {};


    /**
     * @return true if a is in the closed interval range[]
     * @param a value
     * @param range array of 2 values - limits of range.
     */
    function inRange(a, range)
    {
      return range[0] <= a && a <= range[1];
    }


//- moved to ../utils/draw/axis.js :  eltId(), axisEltId(), highlightId()

//- moved to ../utils/domElements.js :  eltClassName()

//- moved to ../utils/domCalcs.js : checkIsNumber()

    /*------------------------------------------------------------------------*/
//-    import { inRange } from "../utils/graph-maths.js";
//-    import {} from "../utils/elementIds.js";

    function mapChrName2Axis(mapChrName)
    {
      let axisName = mapChr2Axis[mapChrName];
      return axisName;
    }
    /** @return chromosome name of axis id. */
    function axisName2Chr(axisName)
    {
      let c = oa.cmName[axisName];
      return c.chrName;
    }
    /** @return chromosome name of axis id, prefixed with mapName. */
    function axisName2MapChr(axisName)
    {
      let c = oa.cmName[axisName];
      return c && makeMapChrName(c.mapName, c.chrName);
    }
    function makeMapChrName(mapName, chrName)
    {
      return mapName + ':' + chrName;
    }
    function makeIntervalName(chrName, interval)
    {
      return chrName + "_" + interval[0] + "_" + interval[1];
    }
//-    moved to "../utils/stacks-drag.js" : dragTransitionNew(), dragTransition(), dragTransitionEnd().

    /*------------------------------------------------------------------------*/
//- moved to ../utils/domCalcs.js : round_2()
    /*------------------------------------------------------------------------*/
    /** These trace variables follow this pattern : 0 means no trace;
     * 1 means O(0) - constant size trace, i.e. just the array lengths, not the arrays.
     * further increments will trace the whole arrays, i.e. O(N),
     * and trace cross-products of arrays - O(N^2) e.g. trace the whole array for O(N) events.
     */
    const trace_stack = 1;
    const trace_scale_y = 0;
    const trace_drag = 0;
    const trace_alias = 1;  // currently no trace at level 1.
    const trace_path = 0;
    const trace_path_colour = 0;
    /** enable trace of adjacency between axes, and stacks. */
    const trace_adj = 1;
    const trace_synteny = 2;
    const trace_gui = 0;
    /*------------------------------------------------------------------------*/
//- moved to utils/stacks.js

    /*------------------------------------------------------------------------*/


    /** Constructor for Flow type.
     *  Wrap the connection of data to display via calculations (aliases etc).
     * These functions operate on an array of Flow-s :  pathUpdate(), collateStacks().
     *
     * The data points in a genetic map are features, in a physical map (chromosome) they are genes.
     * Here, the term feature is used to mean features or genes as appropriate.
     * @param direct	true : match feature names; false : match feature aliases against feature names.
     * @param unique	require aliases to be unique 1:1; i.e. endpoints (features or genes) with only 1 mapping in the adjacent axis are shown
     */
    function Flow(name, direct, unique, collate) {
      this.name = name;
      this.direct = direct;
      this.unique = unique;
      this.collate = collate;
      this.visible = this.enabled;
    };
    Flow.prototype.enabled = true;
    // Flow.prototype.pathData = undefined;
    let flows;
    if ((flows = oa.flows) === undefined) // aka newRender
    {
      oa.flows =
        flows = 
        {
          // direct path() uses featureAxes, collated by collateStacks1();
          direct: new Flow("direct", true, false, collateStacks1/*undefined*/),
          U_alias: new Flow("U_alias", false, false, collateStacks1),	// unique aliases
          alias: new Flow("alias", false, true, collateStacksA)	// aliases, not filtered for uniqueness.
        };
      // flows.U_alias.visible = flows.U_alias.enabled = false;
      // flows.alias.visible = flows.alias.enabled = false;
      // flows.direct.visible = flows.direct.enabled = false;
      flows.direct.pathData = d3Features;
      // if both direct and U_alias are enabled, only 1 should call collateStacks1().
      if (flows.U_alias.enabled && flows.direct.enabled && (flows.U_alias.collate == flows.direct.collate))
        flows.direct.collate = undefined;
    }

    function collateStacks()
    {
      d3.keys(oa.flows).forEach(function(flowName) {
        let flow = oa.flows[flowName];
        if (flow.enabled && flow.collate)
          flow.collate();
      });
    }
//-    import {} from "../utils/flows.js";
//-    import {} from "../components/flows.js";

    /*------------------------------------------------------------------------*/


    let zoomSwitch,resetSwitch;
    let zoomed = false;
    // let reset = false;
    // console.log("zoomSwitch", zoomSwitch);

    let pathFeatures = oa.pathFeatures || (oa.pathFeatures = {}); //For tool tip

    let selectedAxes = oa.selectedAxes || (oa.selectedAxes = []);;
    let selectedFeatures = oa.selectedFeatures || (oa.selectedFeatures = {});
    let brushedRegions = oa.brushedRegions || (oa.brushedRegions = {});

    /** planning to move selectedFeatures out to a separate class/component;
     * these 2 functions would be actions on it. */
    //Reset the selected Feature region, everytime an axis gets deleted
    function sendUpdatedSelectedFeatures()
    {
      if (oa.drawOptions.showSelectedFeatures)
        me.send('updatedSelectedFeatures', selectedFeatures);
    }
    function selectedFeatures_clear()
    {
      selectedFeatures = {};
      sendUpdatedSelectedFeatures();
    }
    /** When an axis is deleted, it is removed from selectedAxes and its features are removed from selectedFeatures.
     * Those features may be selected in another axis which is not deleted; in
     * which case they should not be deleted from selectedFeatures, but this is
     * quicker, and may be useful.
     * Possibly versions of the app did not update selectedAxes in some cases, e.g. when zooms are reset.
     */
    function selectedFeatures_removeAxis(axisName)
    {
      selectedAxes.removeObject(axisName);
      let p = axisName; // based on brushHelper()
      d3.keys(oa.z[p]).forEach(function(f) {
        if (! isOtherField[f])
          delete selectedFeatures[p];
      });
    }

    collateData();

    /** For all Axes, store the x value of its axis, according to the current scale. */
    function collateO() {
      console.log("collateO", oa.axisIDs.length, oa.axisIDs);
      oa.stacks.axisIDs().forEach(function(d){
        let o = oa.o;
        if (trace_stack > 1)
          console.log(d, axisId2Name(d), o[d], stacks.x(d));
        o[d] = stacks.x(d);
        checkIsNumber(oa.o[d]);
        if (o[d] === undefined) { breakPoint("collateO"); }
      });
    }
    let blocksToDraw = oa.axisIDs,
      blocksToAdd = me.get('blockService').get('viewedIds');
    blocksToAdd = blocksToAdd.filter(function (axisName) {
      // axisName passes filter if it is not already in a stack
      return ! Stacked.getAxis(axisName) && (blocksToDraw.indexOf(axisName) == -1) ; });
    console.log(blocksToDraw, 'blocksToAdd', blocksToAdd);
    if (blocksToAdd.length)
      blocksToDraw = blocksToDraw.concat(blocksToAdd);
    let duplicates = blocksToDraw.filter(function (v, i) { return blocksToDraw.indexOf(v, i+1) != -1; });
    if (duplicates.length)
      breakPoint('duplicates', duplicates, blocksToDraw, blocksToAdd, oa.axisIDs);

    // Place new data blocks in an existing or new axis.
    blocksToDraw.forEach(function(d){
    // for (let d in oa.stacks.axes) {
      /** ensure that d is shown in an axis & stack.
       * dBlock should be !== undefined.
       */
      let dBlock = me.peekBlock(d),
      sBlock = oa.stacks.blocks[d],
      addedBlock = ! sBlock;
      if (! sBlock) {
        oa.stacks.blocks[d] = sBlock = new Block(dBlock);
        dBlock.set('view', sBlock);
      }
      let s = Stacked.getStack(d);
      if (trace_stack > 1)
        console.log(d, dBlock, 'sBlock', sBlock, s);
      /* verification
      if (addedBlock == (s !== undefined))
        breakPoint(d, 'addedBlock', addedBlock, sBlock, 'already in stack', s); */
      if (s && ! dBlock.get('view'))
        console.log(d, 'has stack', s, 'but no axis', dBlock);
      if (s && (s.axes.length == 0))
      {
        let axis = sBlock.axis;
        console.log('re-add to stack', d, s, axis);
        s.add(axis);
        oa.stacks.axesP[d] = axis;
        if (oa.stacks.indexOf(s) == -1)
          oa.stacks.append(s);
        axisIDAdd(d);
        s.log();
      }
      else
      // if axisID d does not exist in stacks[], add a new stack for it.
      if (! s)
      {
        let zd = oa.z[d],
        dataset = zd.dataset,
        parent = dataset && dataset.get('parent'),
        parentName = parent && parent.get('name'),  // e.g. "myGenome"
        parentId = parent && parent.get('id'),  // same as name
        namespace = dataset && dataset.get('namespace'),
        /** undefined or axis of parent block of d. */
        parentAxis
        ;
        Stack.verify();

        console.log(d, "zd", zd, dataset && dataset.get('name'), parent, parentName, parentId, namespace);
          // zd.  scope, featureType, , namespace
        // if block has a parent, find a block with name matching parentName, and matching scope.
        if (parentName)
        {
          /** this is alternative to matchParentAndScope() - direct lookup. */
          let parentDataset = oa.datasets[parentName];
          console.log("dataset", parentName, parentDataset);
          function matchParentAndScope (key, value) {
            let block = oa.z[key],
            match = (block.scope == zd.scope) && (block.dataset.get('name') == parentName);
            console.log(key, block, match);
            return match;
          }
          /** undefined if no parent found, otherwise is the id corresponding to parentName */
          let blockName = d3.keys(oa.z).find(matchParentAndScope);
          console.log(parentName, blockName);
          if (blockName)
          {
            let block = oa.z[blockName];
            parentAxis = oa.axesP[blockName];
            console.log(block.scope, block.featureType, block.dataset.get('name'), block.dataset.get('namespace'), "parentAxis", parentAxis);
          }
        }

        let sd;
        /** if any children loaded before this, adopt them */
        let adopt;
        /** Use the stack of the first child to adopt.
         * First draft created a new stack, this may transition better.
         */
        let adopt0;

        if (! parentAxis)
      {
        // initial stacking : 1 axis per stack, but later when db contains Linkage
        // Groups, can automatically stack Axes.
          /* It seems better to re-use oa.axesP[adopt0] instead of creating sd;
           * that requires the adoption search to be done earlier, which is simple,
           * and also will change this significantly, so is better deferred
           * until after current release.
           */
        sd = new Stacked(d, 1, parentAxis); // parentAxis === undefined
          sd.referenceBlock = dBlock;
          console.log('before push sd', sd, sd.blocks, sBlock);
          sd.logBlocks();
          if (sd.blocks.length && sd.blocks[0] === sBlock)
            breakPoint('sBlock already in sd.blocks', sd.blocks);
          else
          {
            sd.blocks.push(sBlock);
            console.log('after push', sd.blocks);
            sd.logBlocks();
          }
          // .parent of referenceBlock is undefined.
        	sBlock.axis = sd;
          if (sBlock !== sd.referenceBlockS())
            console.log('sBlock', sBlock, ' !== sd.referenceBlockS()',  sd.referenceBlockS());

          adopt = 
          d3.keys(oa.axesP).filter(function (d2) {
            let a = oa.stacks.blocks[d2]; //  could traverse just axesP[] and get their reference
            let match = 
              (d != d2) &&  // not self
              ! a.parent && a.parentName && (a.parentName == dataset.get('name')) &&
              a.z.scope && (a.z.scope == oa.cmName[d].scope);
            if (! a.parent)
            {
              console.log(d2, a.parentName,  dataset.get('name'),
                           a.z && a.z.scope,  oa.cmName[d].scope, match); 
          }
            return match;
          });

        if (adopt.length)
        {
          console.log("adopt", adopt);
          adopt0 = adopt.shift();
          let a = oa.axesP[adopt0];
          a.stack.log();
          /** stacks:Block of the block being adopted */
          let aBlock = a.referenceBlockS();
          sd.move(a, 0);

          delete oa.axesP[adopt0];
          deleteAxisfromAxisIDs(adopt0);
          a.stack.remove(adopt0);
          // roughly equivalent : a.stack.move(adopt0, newStack, -1)

          // a.axisName = d;
          a.parent = sd;
          console.log('aBlock.axis', aBlock.axis, sd);
          aBlock.axis = sd;
          a.stack.add(sd);
          console.log(adopt0, a, sd, oa.axesP[a.axisName]);
          sd.stack.log();

          sd.scale = a.scale;
          /** the y scales will be accessed via the new name d. - also update domain */
          console.log('adopt scale', y[d] && 'defined', y[adopt0] && 'defined');
          if (y[d] === undefined)
            y[d] = y[adopt0]; // could then delete y[adopt0]

          /** change the axisID of the DOM elements of the axis which is being adopted.  */
          let aStackS = oa.svgContainer.select("g.axis-outer#" + eltId(adopt0));
          console.log('aStackS', aStackS.size());
          aStackS
            .datum(d)
            .attr("id", eltId);
          if (trace_stack > 1)
          {
          logSelection(aStackS);
          logSelectionNodes(aStackS);
          }

          let gAll = 
            aStackS.select("g.axis-all")
            .attr("id", eltIdAll);

          /** just the <text> which is immediate child of gAll;  could use selectImmediateChildNodes(gAll).
           */
          let axisTitleS = aStackS.select("g.axis-all > text");
          axisTitleFamily(axisTitleS);

          /** update the __data__ of those elements which refer to axis parent block name */
          let dataS = aStackS.selectAll("g.brush, g.stackDropTarget, g.stackDropTarget > rect");
          dataS.each(function () { d3.select(this).datum(d); });

          let gAxisS = aStackS.selectAll("g.axis");
          gAxisS
            .datum(d)
            .attr('id', axisEltId(d))
            .call(axis.scale(y[d]));

          let checkS = aStackS.selectAll("g, g.stackDropTarget > rect");
          checkS.each(function(b,i) {console.log(this,b,i,b.__data__); } );
          // logSelectionNodes(checkS);
        }
        }

          // verification : sd is defined iff this block doesn't have a parent axis and is not adopting a block with an axis.
          if ((sd === undefined) != ((parentAxis || adopt0) === undefined))
            console.log('sd', sd, parentAxis, adopt0);
        let
        /** blocks which have a parent axis do not need a Stack.
         * sd is defined if we need a new axis and hence a new Stack.
         */
        newStack = sd && ! adopt0 && new Stack(sd);
        if (parentAxis)
        {
          console.log("pre-adopt", parentAxis, d, parentName);
          /* axisIDAdd() has already been called (by receiveChr() or from
           * myDataKeys above), so remove d from axisIDs because it is a child
           * data block, not an axis / reference block.
           * Alternative is to use stacks.axisIDs(); splitting out axes as a
           * component will replace oa.axisIDs.
           */
          deleteAxisfromAxisIDs(d);
          delete oa.axesP[d];
          console.log('before push parentAxis', parentAxis, parentAxis.blocks, sBlock);
          parentAxis.logBlocks();
          parentAxis.blocks.push(sBlock);
          console.log('after push', parentAxis.blocks);
          parentAxis.logBlocks();
          sBlock.axis = parentAxis;
          sBlock.parent = parentAxis.referenceBlockS();
          let aStackS1 = oa.svgContainer.select("g.axis-outer#" + eltId(parentAxis.axisName));
          let axisTitleS = aStackS1.select("g.axis-all > text");
          axisTitleFamily(axisTitleS);
        }
        else if (! adopt0)
        {
          /** handle GM-s and reference.
          * : when reference arrives before any children : no .parent.
          * Difference : GM has namespace and features;  reference has range
           */
          let isReference = dBlock.get('range') !== undefined;
          // if (! isReference)
          /* GM has no parent/child separation; it is its own reference and data block.  */
          // set above : sd.referenceBlock = dBlock;
          // sBlock.parent = sd;   //-	.parent should be Block not Stacked
          // could push() - seems neater to place the reference block first.
          console.log('before unshift sd', sd, sd.blocks, sBlock);
          if (sd.blocks.length && sd.blocks[0] === sBlock)
            console.log('sBlock already in sd.blocks', sd.blocks);
          else
          {
            sd.logBlocks();
            sd.blocks.unshift(sBlock);
            console.log('after unshift', sd.blocks);
            sd.logBlocks();
          }
        }
        /** to recognise parent when it arrives.
         * not need when parentAxis is defined.
         */
        if (parentName && ! parentAxis)
        {
          console.log(sd, ".parentName", parentName);
          sBlock.parentName = parentName;
        }
          if (sBlock) { sBlock.z = oa.z[d]; }
        if (sd)
        sd.z = oa.z[d];  // reference from Stacked axis to z[axisID]

          // newStack is only defined if sd is defined (and !adopt0) which is only true if ! parentAxis
        if (newStack)
        {
          console.log("oa.stacks.append(stack)", d, newStack.stackID, oa.stacks);
          oa.stacks.append(newStack);
          console.log(oa.stacks);
          newStack.calculatePositions();
        }

        if (! parentAxis)
          {
        adopt.map(function (d3) {
          /** axis being adopted */
            let a = oa.axesP[d3];
          a.parent = sd;
          /** oldStack will be deleted. `a` will become unreferenced. */
          let oldStack = a.stack;

          /** re-use the Block being adopted. */
          let aBlock = a.referenceBlockS();
          sd.move(a, 0);
          //	-	check that oldStack.delete() will delete the (Stacked) a

          console.log(d3, a, aBlock, sd, oa.axesP[a.axisName]);
          sd.stack.log();
          delete oa.axesP[a.axisName];
          oa.stacks.blocks[a.axisName] = aBlock;
          console.log('aBlock.axis', aBlock.axis);
          aBlock.axis = sd;
          deleteAxisfromAxisIDs(a.axisName);
          if (! oldStack)
            console.log("adopted axis had no stack", a, a.axisName, oa.stacks);
          else
          {
            // remove Stack of a from oa.stacks.  a.stack is already replaced.
            console.log("remove Stack", oldStack, oa.stacks);
            oldStack.delete();
            console.log("removed Stack", oa.stacks, oa.stacks.length, a);
          }
        });
      }
      Stack.verify();
      stacksAxesDomVerify(stacks, oa.svgContainer);
      }
    });
    function axisWidthResize(axisID, width, dx)
    {
      console.log("axisWidthResize", axisID, width, dx);
      oa.axes[axisID].extended = width;
      axisWidthResizeRight(axisID, width, dx);
    };
    function axisWidthResizeEnded()
    {
      console.log("axisWidthResizeEnded");

      updateXScale();
      stacks.changed = 0x10;
        /* Number of stacks hasn't changed, but X position needs to be
         * recalculated, as would be required by a change in the number of stacks. */
      let t = stacksAdjust(true, undefined);
    };
    /**  add width change to the x translation of axes to the right of this one.
      */
    function axisWidthResizeRight(axisID, width, dx)
    {
      console.log("axisWidthResizeRight", axisID, width, dx);
      /** this is like Stack.axisStackIndex().  */
      let axis = oa.axes[axisID], from = axis.stack,
      fromSix = from.stackIndex(),   o = oa.o;
      for (let six=0; six < stacks.length; six++)
      {
        let stack = stacks[six],
        /** apply the dx proportionally to the closeness of the stack to the cursor (e.g. stack index or x distance),
         * and apply it -ve to those to the left, including the stack of the axis extend being resized, so that it mirrors,
         * i.e. right side goes same distance as dx, left side same and opposite,
         */
        close =
          (six == fromSix)
          ? -1/2
          : (six < fromSix)
          ? (six - fromSix) / fromSix
          : (six - fromSix) / (stacks.length - fromSix);
        console.log("close", close, fromSix, six, stacks.length);
        stack.axes.forEach(
          function (a, index)
          {
            o[a.axisName] += (dx * close);
          }
        );
        // could filter the selection - just those right of the extended axis
        svgContainer.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
        stack.axes.forEach( function (a, index) { axisRedrawText(oa.axes[a.axisName]); });
        pathUpdate(undefined);
      }
    };
    this.set('axisWidthResize', function (axisID, width, dx) { axisWidthResize(axisID, width, dx); });
    this.set('axisWidthResizeEnded', function () { axisWidthResizeEnded(); });
    function updateXScale()
    {
      // xScale() uses stacks.keys().
      oa.xScaleExtend = xScaleExtend(); // or xScale();
    }
    let x = stacks.x;
    updateXScale();
    //let dynamic = d3.scaleLinear().domain([0,1000]).range([0,1000]);
    //console.log(axis.scale(y[axisIDs))
    //- stacks_for_axisIDs(); //- added during split

    //- moved to utils/stacks.js: oa.xScaleExtend = xScale();

    if (source == 'dataReceived')
      stacks.changed = 0x10;
    let t = stacksAdjust(true, undefined);
    vc.xDropOutDistance_update(oa);

    //- moved updateRange() to utils/stacksLayout

//-    import {} from "../utils/paths.js";

//-    import {} from "../utils/intervals.js";

    var path_colour_scale;
    let featureScaffold = {}, scaffolds = new Set(), scaffoldFeatures = {};
    let intervals = {}, intervalNames = new Set(), intervalTree = {};
//-scaffolds
    /** scaffoldTicks[axisID] is a set of y locations, relative to the y axis of axisID, of horizontal tick marks.
     * General purpose; first use is for scaffold edges.
     */
    let scaffoldTicks =  oa.scaffoldTicks || (oa.scaffoldTicks = {});
//-sb
    /** syntenyBlocks is an array, each element defines a synteny block which
     * can be seen as a parallelogram connecting 2 axes (Axes); the range on each
     * axis is defined by 2 gene names.
     * This is a simple form for input via the content-editable; the result from the BE API may be factored to :
  { chr1, chr2,
    [
      [ gene1, gene2, gene3, gene4, optional_extra_data],
      ...
    ]
  }, ...
     *
     * (the genes could instead be features on a genetic map, but the planned use of
     * synteny block display is physical maps / genes).
     */
    let syntenyBlocks =  oa.syntenyBlocks || (oa.syntenyBlocks = []);
    if (oa.sbSizeThreshold == undefined)  oa.sbSizeThreshold = 20;      
//- paths-classes
    if (use_path_colour_scale)
    {
      let path_colour_domain;
      switch (use_path_colour_scale)
      {
      case 1 : path_colour_domain = oa.features; break;
      case 2 : path_colour_domain = d3.keys(oa.aliasGroup); break;
      default:
      case 4:
      case 3 : path_colour_domain = ["unused"];
        this.set('colouredFeaturesChanged', function(colouredFeatures_) {
          console.log('colouredFeatures changed, length : ', colouredFeatures_.length);
          let val;
          if ((colouredFeatures_.length !== 0) &&
              ((val = getUsePatchColour()) !== undefined))
          {
            /** use_path_colour_scale manages the effect of the path colouring
             * date entered here; this doesn't allow the different modes
             * selected by use_path_colour_scale to co-exist effectively, but
             * scaffoldTicks is separate, so by distinguishing
             * input_path_colour_scale from use_path_colour_scale, it is
             * possible to use 6 with e.g. 4.
             * ditto 7.
             */
            let input_path_colour_scale = val;
            if ((val != 6) && (val != 7))
              use_path_colour_scale = val;

            /** depending on use_path_colour_scale === 3, 4 each line of featureNames is 
             * 3: featureName 
             * 4: scaffoldName\tfeatureName
             */
            let featureNames = colouredFeatures_
            // .split('\n');
            // .match(/\S+/g) || [];
              .match(/[^\r\n]+/g);
            path_colour_scale_domain_set = featureNames.length > 0;
            if (input_path_colour_scale === 3)
              path_colour_scale.domain(featureNames);
            else if (input_path_colour_scale === 4)
            {
              for (let i=0; i<featureNames.length; i++)
              {
                let col=featureNames[i].split(/[ \t]+/),
                scaffoldName = col[0], featureName = col[1];
                featureScaffold[featureName] = scaffoldName;
                // for the tooltip, maybe not required.
                if (scaffoldFeatures[scaffoldName] === undefined)
                  scaffoldFeatures[scaffoldName] = [];
                scaffoldFeatures[scaffoldName].push(featureName);
                scaffolds.add(scaffoldName);
              }
              collateFeatureClasses(featureScaffold);
              if (showScaffoldFeatures !== me.get('showScaffoldFeatures'))
              {
                showScaffoldFeatures = me.get('showScaffoldFeatures');
                console.log("showScaffoldFeatures", showScaffoldFeatures);
              }
              if (showScaffoldFeatures)
              {
                me.set('scaffolds', scaffolds);
                me.set('scaffoldFeatures', scaffoldFeatures);
              }
              let domain = Array.from(scaffolds.keys());
              console.log("domain.length", domain.length);
              path_colour_scale.domain(domain);
            }
            else if (input_path_colour_scale === 5)
            {
              for (let i=0; i<featureNames.length; i++)
              {
                let col=featureNames[i].split(/[ \t]+/),
                mapChrName = col[0], interval = [col[1], col[2]];
                let axisName = mapChrName2Axis(mapChrName);
                if (intervals[axisName] === undefined)
                  intervals[axisName] = [];
                intervals[axisName].push(interval);
                let intervalName = makeIntervalName(mapChrName, [col[1], + col[2]]);
                intervalNames.add(intervalName);
              }
              d3.keys(intervals).forEach(function (axisName) {
                //Build tree
                intervalTree[axisName] = createIntervalTree(intervals[axisName]);
              });

              // scaffolds and intervalNames operate in the same way - could be merged or factored.
              let domain = Array.from(intervalNames.keys());
              console.log("domain.length", domain.length);
              path_colour_scale.domain(domain);
            }
            else if (input_path_colour_scale === 6)
            {
              for (let i=0; i<featureNames.length; i++)
              {
                let col=featureNames[i].split(/[ \t]+/),
                mapChrName = col[0], tickLocation = col[1];
                let axisName = mapChrName2Axis(mapChrName);
                if (axisName === undefined)
                  console.log("axis not found for :", featureNames[i], mapChr2Axis);
                else
                {
                  if (scaffoldTicks[axisName] === undefined)
                    scaffoldTicks[axisName] = new Set();
                  scaffoldTicks[axisName].add(tickLocation);
                }
              }
              console.log(scaffoldTicks);
              showTickLocations(scaffoldTicks, undefined);
            }
            else if (input_path_colour_scale === 7)
            {
              for (let i=0; i<featureNames.length; i++)
              {
                let cols=featureNames[i].split(/[ \t]+/);
                let ok = true;
                for (let j=0; j < 2; j++)
                {
                  /** Axes of syntenyBlock may not be loaded yet. */
                  let mapChr2Axis = cols[j], axisName = mapChrName2Axis(mapChr2Axis);
                  cols[j] = axisName;
                  if (axisName === undefined)
                    console.log("axis not found for :", featureNames[i], mapChr2Axis);
                  for (let k = 0; k < 2; k++)
                  {
                    let f = cols[2 + 2*j + k];
                    if (oa.z[axisName][f] === undefined)
                    {
                      console.log(f, "not in", axisName, axisId2Name(axisName));
                      ok = false;
                    }
                  }
                  ok &= axisName !== undefined;
                }
                if (ok)
                {
                  syntenyBlocks.push(cols);
                }
              }
              if (trace_synteny)
                console.log(syntenyBlocks.length, syntenyBlocks);
              showSynteny(syntenyBlocks, undefined);
            }
            else if (trace_path_colour > 2)
              console.log("use_path_colour_scale", use_path_colour_scale);

            pathColourUpdate(undefined, undefined);
            scaffoldLegendColourUpdate();
          }
        });
        break;
      }
      path_colour_scale = d3.scaleOrdinal();
      path_colour_scale_domain_set = (use_path_colour_scale !== 3) && (use_path_colour_scale !== 4);
      if (path_colour_scale_domain_set)
        path_colour_scale.domain(path_colour_domain);
      else
        path_colour_scale.unknown(pathColourDefault);
      path_colour_scale.range(d3.schemeCategory10);
    }

//- moved to utils/draw/axis.js : maybeFlip(), maybeFlipExtent()

//-components/stacks 
    /* for each axis :
     * calculate its domain if not already done; 
     * ensure it has a y scale,
     *   make a copy of the y scale - use 1 for the brush
     */
    oa.stacks.axisIDs().forEach(function(d) {
      let a = oa.axes[d];
      // now a is Stacked not Block, so expect ! a.parent
      if (a.parent && ! a.parent.getDomain)
        breakPoint('domain and ys', d, a, a.parent);
      let
      /** similar domain calcs in resetZoom().  */
      domain = a.parent ? a.parent.getDomain() : a.getDomain();
      if (false)      //  original, replaced by domainCalc().
      {
      /** Find the max of locations of all features of axis name d. */
      let yDomainMax = d3.max(Object.keys(oa.z[d]), function(a) { return oa.z[d][a].location; } );
        domain = [0, yDomainMax];
      }
      let myRange = a.yRange(), ys = oa.ys, y = oa.y;
      if (ys[d])  // equivalent to (y[d]==true), y[d] and ys[d] are created together
      {
        if (trace_stack > 1)
          console.log("ys exists", d, ys[d].domain(), y[d].domain(), ys[d].range());
      }
      else
      {
      ys[d] = d3.scaleLinear()
        .domain(maybeFlip(domain, a.flipped))
        .range([0, myRange]); // set scales for each axis
      
      //console.log("OOO " + y[d].domain);
      // y and ys are the same until the axis is stacked.
      // The brush is on y.
      y[d] = ys[d].copy();
      y[d].brush = d3.brushY()
        .extent(maybeFlipExtent([[-8,0],[8,myRange]], a.flipped))
        .on("end", brushended);
      }
    });
    /** when draw( , 'dataReceived'), pathUpdate() is not valid until ys is updated. */
    let ysUpdated = true;

    let svgRoot;
    let newRender = (svgRoot = oa.svgRoot) === undefined;
    if (newRender)
    {
      // Use class in selector to avoid removing logo, which is SVG.
    d3.select("svg.FeatureMapViewer").remove();
    d3.select("div.d3-tip").remove();
    }
    let translateTransform = "translate(" + margins[marginIndex.left] + "," + margins[marginIndex.top] + ")";
    if (newRender)
    {
        let graphDim = oa.vc.graphDim;
      oa.svgRoot = 
    svgRoot = d3.select('#holder').append('svg')
      .attr("class", "FeatureMapViewer")
      .attr("viewBox", oa.vc.viewBox.bind(oa.vc))
      .attr("preserveAspectRatio", "none"/*"xMinYMin meet"*/)
      .attr('width', "100%" /*graphDim.w*/)
      .attr('height', graphDim.h /*"auto"*/);
      oa.svgContainer =
    svgContainer = svgRoot
      .append("svg:g")
      .attr("transform", translateTransform);

      stacks.dragTransition = new DragTransition(oa.svgContainer);

      console.log(oa.svgRoot.node(), '.on(resize', this.resize);

      let resizeThis =
        // this.resize.bind(oa);
              function(transition) {
                  console.log("resizeThis", transition);
                  Ember.run.debounce(oa, me.resize, [transition], 500);
              };
        /** d3 dispatch.on() does not take arguments, and similarly for eltWidthResizable() param resized. */
        function resizeThisWithTransition() { resizeThis(true); }
        function resizeThisWithoutTransition() { resizeThis(false); }

        // This detects window resize, caused by min-/max-imise/full-screen.
      if (true)
      d3.select(window)
        .on('resize', resizeThisWithTransition);
        else  // also works, can drop if further testing doesn't indicate one is better.
            Ember.$( window )
            .resize(function(e) {
                console.log("window resize", e);
                // see notes in domElements.js regarding  .resize() debounce
                Ember.run.debounce(resizeThisWithTransition, 300);
            });

      /* 2 callbacks on window resize, register in the (reverse) order that they
       * need to be called (reorganise this).
       * Revert .resizable flex-grow before Viewport().calc() so the latter gets the new size.  */
      eltWidthResizable('.resizable', undefined, resizeThisWithoutTransition);
    }
    else
      svgContainer = oa.svgContainer;


    d3.select('body')
      .classed("devel", this.get('params.devel'));

    function setCssVariable(name, value)
    {
      oa.svgRoot.style(name, value);
    }

//-paths
    /** total the # paths collated for the enabled flows.
     * Used to adjust the stroke-width and stroke-opacity.
     */
    function countPaths()
    {
      let svgRoot = oa.svgRoot;
      console.log("countPaths", svgRoot);
      if (svgRoot)
      {
        let nPaths = 0;
        d3.keys(flows).forEach(function(flowName) {
          let flow = flows[flowName];
          if (flow.enabled && flow.collate)
          {
            nPaths += flow.pathData.length;
            console.log("countPaths", flow.name, flow.pathData.length, nPaths);
          }
        });
        svgRoot.classed("manyPaths", nPaths > 200);
      }
    }
    /** Same as countPaths(), but counting only the paths with data, which excludes
     * those which are outside the zoom range.  */
    function countPathsWithData()
    {
      let svgRoot = oa.svgRoot;
      if (trace_path)
        console.log("countPathsWithData", svgRoot);
      if (svgRoot)
      {
        let paths = Ember.$("path[d!=''][d]"),
        nPaths = paths.length;
        svgRoot.classed("manyPaths", nPaths > 200);
        if (trace_path)
          console.log(nPaths, svgRoot._groups[0][0].classList);
      }
    }

    //User shortcut from the keybroad to manipulate the Axes
    d3.select("#holder").on("keydown", function() {
      if ((String.fromCharCode(d3.event.keyCode)) == "D") {
        console.log("Delete axis (not implemented)");
        // deleteAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "Z") {
        zoomAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "R") {
        refreshAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == "A") {
        oa.drawOptions.showAll = !oa.drawOptions.showAll;
        console.log("showAll", oa.drawOptions.showAll);
        refreshAxis();
      }
      else if ((String.fromCharCode(d3.event.keyCode)) == " ") {
        console.log("space");
      }
    });

//-paths
    //Add foreground lines.
    /** pathData is the data of .foreground > g > g, not .foreground > g > g > path */
    function pathDataSwitch() {
      let p = unique_1_1_mapping === 3 ? put
        : (unique_1_1_mapping ? pathsUnique : d3Features);
      return p; }
    let pathData = pathDataSwitch();
    d3.keys(flows).forEach(function(flowName) {
      let flow = flows[flowName];
      // if flow.collate then flow.pathData has been set above by collateStacks().
      if (flow.enabled && ! flow.collate)
        flow.pathData = flow.direct ? d3Features : (flow.unique ? pathsUnique : put);
    });
    /** class of path or g, @see pathDataInG. currently just endpoint features, could be aliasGroupName.  */
    /** If Flow.direct then use I for pathClass, otherwise pathClassA()  */
    function pathClassA(d)
    { let d0=d[0], d1=d[1], c = d1 && (d1 != d0) ? d0 + "_" + d1: d0;
      return c; }
    /**  If unique_1_1_mapping then path data is ffaa, i.e. [feature0, feature1, a0, a1]
     */
    function featureNameOfData(da)
    {
      let featureName = (da.length === 4)  // i.e. unique_1_1_mapping
        ? da[0]  //  ffaa, i.e. [feature0, feature1, a0, a1]
        : da;
      return featureName;
    }
    /** @see also pathsUnique_log()  */
    function data_text(da)
    {
      return unique_1_1_mapping   // ! flow.direct
        ? [da[0], da[1], da[2].mapName, da[3].mapName]
        : da;
    }

    // this condition is equivalent to newRender
    if ((foreground = oa.foreground) === undefined)
    {
      oa.foreground =
    foreground = svgContainer.append("g") // foreground has as elements "paths" that correspond to features
      .attr("class", "foreground");
    d3.keys(flows).forEach(function(flowName) {
      let flow = flows[flowName];
      flow.g = oa.foreground.append("g")
        .attr("class", flowName);
    });
    }
    
    pathUpdate(undefined);
    stacks.log();

//-components/stacks
    // Add a group element for each stack.
    // Stacks contain 1 or more Axes.
    /** selection of stacks */
    let stackSd = svgContainer.selectAll(".stack")
      .data(stacks, Stack.prototype.keyFunction),
    stackS = stackSd
      .enter()
      .append("g"),
    stackX = stackSd.exit();
      if (trace_stack)
      {
        console.log("append g.stack", stackS.size(), stackSd.exit().size(), stackS.node(), stackS.nodes());
        if (oa.stacks.length > stackSd.size() + stackS.size())
        {
          console.log("missed stack", oa.stacks.length, stackSd.size());
          breakPoint();
        }
      }
    let removedStacks = 
      stackX;
    if (removedStacks.size())
    {
      logSelection(removedStacks);
      logSelectionNodes(removedStacks);
      console.log('removedStacks', removedStacks.size());
      let ra = removedStacks.selectAll("g.axis-outer");
      console.log('ra', ra, ra.nodes(), ra.node());
      ra.each(function (d, i, g) {
        console.log(d, i, this);
        let rag = this,
        ras = Stacked.getStack(d), sDest;
        if (! ras)
        {
          // this is OK - just information
          console.log('axis no longer in a stack', d);
        }
        else
          // check that target is not parent
          if ((sDest = ras && svgContainer.select("g.stack#" + eltId(ras.stackID)))
              && ! sDest.empty() && (sDest.node() !== this.parentElement))
        {
            console.log('to stack', ras.stackID, sDest.node());
            let
              moved = sDest.insert(function () { return rag; });
            console.log(moved.node(), moved.node().parentElement);
          }
      });
      console.log('remnant', removedStacks.node());
    }
    stackX
      .transition().duration(500)
      .remove();

      /*
    let st = newRender ? stackS :
      stackS.transition().duration(dragTransitionTime);
    let stackS_ = st
       */
      stackS
      .attr("class", "stack")
      .attr("id", stackEltId);

    function stackEltId(s)
    { if (s.stackID === undefined) breakPoint();
      console.log("stackEltId", s.stackID, s.axes[0].mapName, s);
      return eltId(s.stackID); }

    /** For the given Stack, return its axisIDs.
     * @return [] containing string IDs of reference blocks of axes of the Stack.
     */
    function stack_axisIDs(stack)
    {
      let result = stack.parentAxisIDs();
      if (trace_stack > 1)
        console.log('stack_axisIDs', stack, result);
      return result;
    }

    if (stackS && trace_stack >= 1.5)
      logSelection(stackS);

    // Add a group element for each axis.
    // Stacks are selection groups in the result of this .selectAll()
    let axisS =
      stackSd.merge(stackS)
      .selectAll(".axis-outer"),
    axisG = axisS
      .data(stack_axisIDs)
      .enter().append("g"),
    axisX = axisS.exit();
    console.log('stacks.length', stacks.length, axisG.size(), axisX.size());
    axisG.each(function(d, i, g) { console.log(d, i, this); });
    axisX.each(function(d, i, g) { console.log('axisX', d, i, this); });
    axisX.remove();
    let allG = axisG
      .append('g')
      .attr("class", "axis-all")
      .attr("id", eltIdAll);
    if (axisG.size())
      console.log(allG.nodes(), allG.node());
    function eltIdAll(d) { return "all" + d; }
    function eltIdGpRef(d, i, g)
    {
      console.log("eltIdGpRef", this, d, i, g);
      let p2 = this.parentNode.parentElement;
      return "#a" + p2.__data__;
    }
    function getAxisExtendedWidth(axisID)
    {
      let axis = oa.axes[axisID],
      initialWidth = 50,
      width = axis ? ((axis.extended === true) ? initialWidth : axis.extended) : undefined;
      return width;
    }
    function axisShowExtend(axis, axisID, axisG)
    {
      /** x translation of right axis */
      let 
        initialWidth = 50,
      axisData = axis.extended ? [axisID] : [];
      if (axisG === undefined)
        axisG = svgContainer.selectAll("g.axis-outer#id" + axisID);
      let ug = axisG.selectAll("g.axis-use")
        .data(axisData);
      let ugx = ug
        .exit()
        .transition().duration(500)
        .remove();
      ugx
        .selectAll("use")
        .attr("transform",function(d) {return "translate(0,0)";});
      ugx
        .selectAll("rect")
        .attr("width", 0);
      ugx
        .selectAll(".foreignObject")
        .attr("width", 0);
      let eg = ug
        .enter()
        .append("g")
        .attr("class", "axis-use");
      // merge / update ?

      let eu = eg
      /* extra "xlink:" seems required currently to work, refn :  dsummersl -
       * https://stackoverflow.com/questions/10423933/how-do-i-define-an-svg-doc-under-defs-and-reuse-with-the-use-tag */
        .append("use").attr("xlink:xlink:href", eltIdGpRef);
      eu.transition().duration(1000)
        .attr("transform",function(d) {return "translate(" + getAxisExtendedWidth(d) + ",0)";});

      let er = eg
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 0)
        .attr("height", vc.yRange);
      er
        .transition().duration(1000)
        .attr("width", initialWidth);

      // foreignObject is case sensitive - refn https://gist.github.com/mbostock/1424037
      let ef = eg
        .append("g")
        .attr("class", "axis-html")
        .append("foreignObject")
        .attr("class", "foreignObject")
      /*.attr("x", 0)
       .attr("y", 0) */
        .attr("width", initialWidth /*0*/)
        .attr("height", vc.yRange);
      let eb = ef
        .append("xhtml:body")
        .attr("class", "axis-table");
      ef
        .transition().duration(1000)
        .attr("width", initialWidth);
      if (eb.node() !== null)	  // .style() uses .node()
        eb
        .append("div")
        .attr("id", "axis2D_" + axisID) // matches axis-2d:targetEltId()
        .style("border:1px green solid");

      me.send('enableAxis2D', axisID, axis.extended);
    }

    if (trace_stack)
    {
      if (trace_stack > 1)
        oa.stacks.forEach(function(s){console.log(s.axisIDs());});
      let g = axisG;
      console.log("g.axis-outer", g.enter().size(), g.exit().size(), stacks.length);
    }
    axisG
      .attr("class", "axis-outer")
      .attr("id", eltId);
    let g = axisG;
    /** stackS / axisG / g / gt is the newly added stack & axis.
     * The X position of all stacks is affected by this addition, so
     * re-apply the X transform of all stacks / axes, not just the new axis.
     */
    let ao =
      svgContainer.selectAll('.axis-outer');  // equiv: 'g.stack > g'
    /** apply the transform with a transition if changing an existing drawing. */
    let gt = newRender ? ao :
      ao.transition().duration(dragTransitionTime);
    if (trace_stack > 2)
    {
      console.log('.axis-outer');
      logSelectionNodes(gt);
    }
    /* could be used to verify ao selection. */
    if (trace_stack > 3)
    {
      let ga =  selectImmediateChildNodes(svgContainer);
      console.log('svgContainer > g');
      logSelectionNodes(ga);
      let ao1 = svgContainer.selectAll("g.stack > g");  //.axis-outer
      logSelectionNodes(ao1);
    }
    ao
      .attr("transform", Stack.prototype.axisTransformO);
    g
      .call(
        d3.drag()
          .subject(function(d) { return {x: oa.stacks.x(d)}; }) //origin replaced by subject
          .filter(noShiftKeyfilter)
          .on("start", dragstarted) //start instead of dragstart in v4. 
          .on("drag", dragged)
          .on("end", dragended));//function(d) { dragend(d); d3.event.sourceEvent.stopPropagation(); }))
    if (g && trace_stack >= 1.5)
      logSelection(g);

//-components/axis
    /*------------------------------------------------------------------------*/
    /** the DropTarget which the cursor is in, recorded via mouseover/out events
     * on the DropTarget-s.  While dragging this is used to know the DropTarget
     * into which the cursor is dragged.
     */
    // oa.currentDropTarget /*= undefined*/;

    function DropTarget() {
      let viewPort = oa.vc.viewPort;
      let size = {
        /** Avoid overlap, assuming about 5-7 stacks. */
        w : Math.round(Math.min(axisHeaderTextLen, viewPort.w/15)),
        // height of dropTarget at the end of an axis
        h : Math.min(80, viewPort.h/10),
        // height of dropTarget covering the adjacent ends of two stacked axes
        h2 : Math.min(80, viewPort.h/10) * 2 /* + axis gap */
      },
      posn = {
        X : Math.round(size.w/2),
        Y : /*YMargin*/10 + size.h
      },
      /** top and bottom edges relative to the axis's transform.
       */
      edge = {
        top : size.h,
        /** Originally bottom() depended on the axis's portion, but now g.axis-outer
         * has a transform with translate and scale which apply the axis's portion
         * to the elements within g.axis-outer.
         * So bottom() is now based on vc.yRange instead of axis.yRange().
         * @param axis is not used - see comment re. edge.
         */
        bottom : function (axis) { return vc.yRange /* formerly axis.yRange() */ - size.h; }
      };
      /** Same as dropTargetY().
       * Called via d3 .attr().
       * @param this  <rect> DOM element in g.stackDropTarget
       */
      function dropTargetYresize () {
        /** DOMTokenList. contains top or bottom etc */
        let rect = this,
        parentClasses = rect.parentElement.classList,
        top = parentClasses.contains('top'),
        bottom = parentClasses.contains('bottom'),
        yVal = top ? -oa.vc.dropTargetYMargin : edge.bottom(undefined);
        // console.log('dropTargetYresize', rect, parentClasses, top, bottom, yVal);
        return yVal;
      };

      /** @return axis which this DropTarget is part of */
      DropTarget.prototype.getAxis = function ()
      {
        /** The datum of the DropTarget is the axisName */
        let axisName = this.datum(),
        axis = oa.axes[axisName];
        return axis;
      };
      /// @parameter top  true or false to indicate zone is positioned at top or
      /// bottom of axis
      /// uses g, a selection <g> of all Axes
      DropTarget.prototype.add = function (top)
      {
        // Add a target zone for axis stacking drag&drop
        let stackDropTarget = 
          g.append("g")
          .attr("class", "stackDropTarget" + " end " + (top ? "top" : "bottom"));
        let
          dropTargetY = function (datum/*, index, group*/) {
            let axisName = datum,
            axis = oa.axes[axisName],
            yVal = top ? -oa.vc.dropTargetYMargin : edge.bottom(axis);
            if (Number.isNaN(yVal))
            {
              console.log("dropTargetY", datum, axis, top, oa.vc.dropTargetYMargin, edge.bottom(axis));
              breakPoint();
            }
            return yVal;
          };
        stackDropTarget
          .append("rect")
          .attr("x", -posn.X)
          .attr("y", dropTargetY)
          .attr("width", 2 * posn.X)
          .attr("height", posn.Y)
        ;

        stackDropTarget
          .on("mouseover", dropTargetMouseOver)
          .on("mouseout", dropTargetMouseOut);
      };

      /** The original design included a drop zone near the middle of the axis,
       * for dropping an axis out of its current stack; this is replaced by
       * dropping past xDropOutDistance, so this is not enabled.
       * @parameter left  true or false to indicate zone is positioned at left or
       * right of axis
       */
      DropTarget.prototype.addMiddle = function (left)
      {
        // Add a target zone for axis stacking drag&drop
        let stackDropTarget = 
          g.append("g")
          .attr("class", "stackDropTarget" + " middle " + (left ? "left" : "right"));
        function dropTargetHeight(datum/*, index, group*/)
        {
          // console.log("dropTargetHeight", datum, index, group);
          /** dropTargetHeight is axis height minus the height of the top and bottom drop zones.
           * Translate and scale is provided by transform of g.axis-outer, so
           * use vc yRange not axis.yRange().  More detailed comment in @see edge.bottom().
           * So axis is not used :
          let axisName = datum,
          axis = oa.axes[axisName];
           */
          return vc.yRange - 2 * size.h;
        }
        stackDropTarget
          .append("rect")
          .attr("x", left ? -1 * (oa.vc.dropTargetXMargin + posn.X) : oa.vc.dropTargetXMargin )
          .attr("y", edge.top)
          .attr("width", posn.X /*- oa.vc.dropTargetXMargin*/)
          .attr("height", dropTargetHeight)
        ;

        stackDropTarget
          .on("mouseover", dropTargetMouseOver)
          .on("mouseout", dropTargetMouseOut);
      };

      /** Show the affect of window resize on axis drop target zones.
       * Only the y value of g.top > rect elements need be changed.
       * Target zone width could be changed in response to window width change - that is not done.
       */
      DropTarget.prototype.showResize = function ()
      {
        svgContainer.selectAll('g.stackDropTarget.bottom > rect')
          .attr("y", dropTargetYresize)
          // .each(function(d, i, g) { console.log(d, i, this); })
        ;
      };

      function storeDropTarget(axisName, classList)
      {
        oa.currentDropTarget = {axisName: axisName, classList: classList};
      }

      function dropTargetMouseOver(data, index, group){
        console.log("dropTargetMouseOver() ", this, data, index, group);
        this.classList.add("dragHover");
        storeDropTarget(data, this.classList);
      }
      function dropTargetMouseOut(d){
        console.log("dropTargetMouseOut", d);
        this.classList.remove("dragHover");
        oa.currentDropTarget = undefined;
      }

    }
    let dropTarget = new DropTarget();

    [true, false].forEach(function (i) {
      dropTarget.add(i);
      // dropTarget.addMiddle(i);
    });


    /** from newly added g.axis-all : filter out those which have a parent which draws their axis. */
      g = allG
      .filter(function (d) { return oa.axesP[d]; } )
    ;
    if (trace_stack > 1)
    {
      console.log(oa.axesP, "filter", g.size(), allG.size());
      logSelection(g);
    }

    // Add an axis and title
      /** This g is referenced by the <use>. It contains axis path, ticks, title text, brush. */
      let defG =
    g.append("g")
      .attr("class", "axis")
      .each(function(d) { d3.select(this).attr("id",axisEltId(d)).call(axis.scale(y[d])); });  

    function axisTitle(chrID)
    {
      let cn=oa.cmName[chrID];
      // console.log(".axis text", chrID, cn);
      return cn.mapName + " " + cn.chrName;
    }
    function axisTitleChildren(chrID)
    {
      let cn=oa.cmName[chrID],
      children = oa.stacks.blocks[chrID].getAxis().titleText();
      return children;
    }

    let axisTitleS = g.append("text")
      .attr("y", -axisFontSize)
      .style("font-size", axisFontSize);
    axisTitleFamily(axisTitleS);
    /** true if any axes have children.  used to get extra Y space at top for multi-level axis title.
      * later can calculate this, roughly : oa.stacks.axesP.reduce(function (haveChildren, a) { return haveChildren || oa.stacks.axesP[a].blocks.length; } )
     * The maximum value of that can be used as the value of Viewport:calc(): axisNameRows.
     */
    let someAxesHaveChildBlocks = true;

    function axisTitleFamily(axisTitleS) {
      axisTitleS
      .text(axisTitle /*String*/)
      // shift upwards if >1 line of text
        .each(function (d) {
          let axis = Stacked.getAxis(d),
          length = axis && axis.blocks.length;
          if (length && length > 1)
          {
            /** -12 is the default;  -30 looks OK for 2 rows of text. */
            let y = '' + (-12 - ((length-1) * 18));
            d3.select(this)
              .attr('y', y + 'px');
          }
        })
      ;

    axisTitleS.selectAll("tspan")
      .data(axisTitleChildren)
      .enter()
      .append("tspan")
      .text(function (d) { return d; })
      .attr('x', '0px')
      .attr('dx', '0px')
      .attr('dy',  function (d, i) { return "" + (i*0.8+1.5)  + "em"; })
      .style('stroke', function (d) {
        let
          colour = axisTitle_colour_scale(d);
        return colour;
      })
    ;
    };



    axisTitleS
        .each(configureAxisTitleMenu);
    let axisSpacing = (axisXRange[1]-axisXRange[0])/stacks.length;
    let verticalTitle;
    if ((verticalTitle = axisSpacing < 90))
    {
      // first approx : 30 -> 30, 10 -> 90.  could use trig fns instead of linear.
      let angle = (90-axisSpacing);
      if (angle > 90) angle = 90;
      angle = -angle;
      // apply this to all consistently, not just appended axis.
      // Need to update this when ! verticalTitle, and also 
      // incorporate extendedWidth() / getAxisExtendedWidth() in the
      // calculation, perhaps integrated in xScaleExtend()
      let axisTitleA =
        axisG.merge(axisS).selectAll("g.axis-all > text");
      axisTitleA
        .style("text-anchor", "start")
        .attr("transform", "rotate("+angle+")");
    }
    svgRoot.classed("verticalTitle", verticalTitle);

//- moved to ../utils/draw/axis.js : yAxisTextScale(),  yAxisTicksScale(),  yAxisBtnScale()

    // Add a brush for each axis.
    allG.append("g")
      .attr("class", "brush")
      .each(function(d) { d3.select(this).call(oa.y[d].brush); });


    // Setup the path hover tool tip.
    let toolTipCreated = ! oa.toolTip;
    let toolTip = oa.toolTip || (oa.toolTip =
      d3.tip()
        .attr("class", "toolTip d3-tip")
        .attr("id","toolTip")
    );
    if (toolTipCreated)
    {
      me.ensureValue("toolTipCreated", true);
    }
    toolTip.offset([-15,0]);
    svgRoot.call(toolTip);


    //Probably leave the delete function to Ember
    //function deleteAxis(){
    //  console.log("Delete");
    //}

    /** remove g#axisName
     */
    function removeAxis(axisName, t)
    {
      let axisS = svgContainer.select("g.axis-outer#" + eltId(axisName));
      console.log("removeAxis", axisName, axisS.empty(), axisS);
      axisS.remove();
    }
    /** remove g.stack#id<stackID
     */
    function removeStack(stackID, t)
    {
      let stackS = svgContainer.select("g.stack#" + eltId(stackID));
      console.log("removeStack", stackID, stackS.empty(), stackS);
      stackS.remove();
    }
    /** remove axis, and if it was only child, the parent stack;  pathUpdate
     * @param stackID -1 (result of .removeStacked) or id of stack to remove
     * @param stack refn to stack - if not being removed, redraw it
     */
    function removeAxisMaybeStack(axisName, stackID, stack)
    {
      let t = svgContainer.transition().duration(750);
      removeAxis(axisName, t);
      /** number of stacks is changing */
      let changedNum = stackID != -1;
      if (changedNum)
      {
        removeStack(stackID, t);
      }
      else
      {
        console.log("removeAxisMaybeStack", axisName, stackID, stack);
        if (stack)
          stack.redraw(t);
      }
      stacks.changed = 0x10;
      /* Parts of stacksAdjust() are applicable to the 2 cases above : either a
       * stack is removed, or a stack is non-empty after an axis is removed from
       * it.  This is selected by changedNum.
       *
       * stacksAdjust() calls redrawAdjacencies() (when changedNum) for all
       * stacks, but only need it for the stacks on either side of the removed
       * stack.
       */
      stacksAdjust(changedNum, t);
    }
    /** Called when an axis and/or stack has change position.
     * This can affect Axis positions, and because data is filtered by the
     * current adjacencies, the displayed data.
     * Update the drawing to reflect those changes.
     * @param t undefined or transition to use for d3 element updates.
     */
    function axisStackChanged(t)
    {
      showTickLocations(scaffoldTicks, t);
      showSynteny(syntenyBlocks, t);

      me.trigger('axisStackChanged', t);
    }


//-components/paths
    //d3.selectAll(".foreground > g > g").selectAll("path")
    /* (Don, 2017Mar03) my reading of handleMouse{Over,Out}() is that they are
     * intended only for the paths connecting features in adjacent Axes, not
     * e.g. the path in the y axis. So I have narrowed the selector to exclude
     * the axis path.  More exactly, these are the paths to include and exclude,
     * respectively :
     *   svgContainer > g.foreground > g.flowName > g.<featureName> >  path
     *   svgContainer > g.stack > g.axis-outer > g.axis#<axisEltId(axisName)> > path    (axisEltId() prepends "a"))
     * (axisName is e.g. 58b504ef5230723e534cd35c_MyChr).
     * This matters because axis path does not have data (observed issue : a
     * call to handleMouseOver() with d===null; reproduced by brushing a region
     * on an axis then moving cursor over that axis).
     */
    setupMouseHover(
      d3.selectAll(".foreground > g > g > path")
    );

    /** Setup the functions handleMouse{Over,Out}() on events mouse{over,out}
     * on elements in the given selection.
     * The selected path elements are assumed to have __data__ which is either
     * sLine (svg line text) which identifies the hover text, or ffaa data
     * which enables hover text to be calculated.
     * @param pathSelection	<path> elements
     */
    function setupMouseHover(pathSelection)
    {
      pathSelection
        .on("mouseover",handleMouseOver)
        .on("mouseout",handleMouseOut);
    }

    function toolTipMouseOver()
    {
      let toolTipHovered = me.get('toolTipHovered') ;
      console.log("toolTipMouseOver", toolTipHovered);
      if (! toolTipHovered)
        me.set('toolTipHovered', true);
    }
    function toolTipMouseOut()
    {
      let toolTipHovered = me.get('toolTipHovered') ;
      console.log("toolTipMouseOut", toolTipHovered);
      if (toolTipHovered)
        me.set('toolTipHovered', false);
      hidePathHoverToolTip();
    }
    function closeToolTip() 
    {
      console.log("draw-map closeToolTip");
      me.ensureValue('toolTipHovered', false);
      hidePathHoverToolTip();
    }
    if (this.actions.closeToolTipA === undefined)
    {
      this.actions.closeToolTipA = closeToolTip;
    }
    function setupToolTipMouseHover()
    {
      // may need to set toolTipHovered if toolTip already contains cursor when it is shown - will toolTipMouseOver() occur ?.
      // me.ensureValue('toolTipHovered', true);

      d3.select("div.toolTip.d3-tip#toolTip")
        .on("mouseover", toolTipMouseOver)
        .on("mouseout", toolTipMouseOut);

      Ember.$("div.toolTip.d3-tip#toolTip button#toolTipClose")
        .on("click", closeToolTip);
    }


    /**
     * @param d   SVG path data string of path
     * @param this  path element
     */
    function handleMouseOver(d, i){
      let sLine, pathFeaturesHash;
      let pathFeatures = oa.pathFeatures;
      let hoverFeatures;
      /** d is either sLine (pathDataIsLine===true) or array ffaa. */
      let pathDataIsLine = typeof(d) === "string";
      // don't interrupt dragging with pathHover
      if (Stack.currentDrag || ! oa.drawOptions.showPathHover)
        return;
      if (pathDataIsLine)
      {
        pathFeaturesHash = pathFeatures[d];
        hoverFeatures = Object.keys(pathFeaturesHash);
        console.log("hoverFeatures 1", hoverFeatures);
      }
      else
      {
        sLine = this.getAttribute("d");
        pathFeaturesHash = pathFeatures[sLine];
        if ((pathFeaturesHash === undefined) && ! pathDataIsLine)
        {
          let ffaa = dataOfPath(this),
          [feature0, feature1, a0, a1] = ffaa;
          let z = oa.z;
          pathFeatureStore(sLine, feature0, feature1, z[a0.axisName][feature0], z[a1.axisName][feature1]);
          pathFeaturesHash = pathFeatures[sLine];
        }
        // can also append the list of aliases of the 2 features
        hoverFeatures = Object.keys(pathFeaturesHash)
          .reduce(function(all, a){
            // console.log(all, a, a.split(','));
            return  all.concat(a.split(","));
          }, []);
        console.log("hoverFeatures 2,3", hoverFeatures);
      }
      /** pathClasses uses this datum instead of d.  */
      let classSet = pathClasses(this, d), classSetText;
      if (classSet)
      {
        if (typeof classSet == "string")
        {
          console.log(this, d, classSet, classSetText);
          classSetText = "<br />" + classSet;
        }
        else if (classSet.size && classSet.size > 0)
        {
          classSet.forEach(function (className) {
            console.log(className);
            classSetText = "<br />" + className;
          });
        }
      }

      // console.log(d, featureNameOfData(d), sLine, pathFeaturesHash);
      let listFeatures  = "";
      // stroke attributes of this are changed via css rule for path.hovered
      d3.select(this)
        .classed("hovered", true);
      Object.keys(pathFeaturesHash).map(function(a){
        let hoverExtraText = pathFeaturesHash[a];
        if (hoverExtraText === 1) hoverExtraText = "";
        else if (classSetText) hoverExtraText += classSetText;
        listFeatures = listFeatures + a + hoverExtraText + "<br />";
      });

      let hoveredPath = this;
      toolTip.offset(function() {
        return [hoveredPath.getBBox().height / 2, 0];
      });

      /** If path-hover currently exists in toolTip, avoid insert error by detaching it while updating html of parent toolTip */
      let
        pt=Ember.$('.toolTip.d3-tip#toolTip'),
      ph = pt.find('.pathHover');
      console.log(pt[0], "pathHover:", ph[0] || ph.length);
      if (ph.length)
      {
        console.log("pathHover detaching");
      }
      let
        ph1=ph.detach();

      listFeatures += '\n<button id="toolTipClose">&#x2573;</button>\n'; // ╳
      toolTip.html(listFeatures);

      toolTip.show(d, i);
      let ph2=ph1.appendTo(pt);
      Ember.run.once(me, function() {
        let ph3= Ember.$('.pathHover');
        console.log(".pathHover", ph2[0] || ph2.length, ph3[0] || ph3.length);
        me.set("hoverFeatures", hoverFeatures);
        // me.ensureValue("pathHovered", true);
        me.trigger("pathHovered", true, hoverFeatures);
      });
      Ember.run.later(me, function() {
        setupToolTipMouseHover();
      }, 1000);
    }

    function hidePathHoverToolTip() {
      console.log("hidePathHoverToolTip", me.get('toolTipHovered'));
      Ember.run.debounce(me, function () {
      if (! me.get('toolTipHovered'))
      {
        toolTip.hide();
        // me.ensureValue("pathHovered", false);
        me.trigger("pathHovered", false);
      }
      }, 1000);
    }

    function handleMouseOut(d){
      // stroke attributes of this revert to default, as hover ends
      d3.select(this)
        .classed("hovered", false);
      Ember.run.debounce(me, hidePathHoverToolTip, 2000);
    }

//- axis

    function zoomAxis(){
      console.log("Zoom : zoomAxis()");
    }
    function refreshAxis(){
      console.log("Refresh");
    }

    /*------------------------------------------------------------------------*/
    /** Draw horizontal ticks on the axes, representing scaffold boundaries.
     * @param t transition or undefined
     */
    function showTickLocations(scaffoldTicks, t)
    {
      d3.keys(scaffoldTicks).forEach
      (function(axisName)
       {
         let tickLocations = Array.from(scaffoldTicks[axisName].keys());
         /** -  if axisName matches nothing, then skip this. */
        let aS = d3.select("#" + axisEltId(axisName));
        if (!aS.empty())
        {
          let pS = aS.selectAll("path.horizTick")
             .data(tickLocations),
             pSE = pS.enter()
             .append("path")
            .attr("class", "horizTick");
          pSE
            .each(configureHorizTickHover);
         let pSM = pSE.merge(pS);

          /* update attr d in a transition if one was given.  */
          let p1 = (t === undefined) ? pSM
            : pSM.transition(t);
          p1.attr("d", function(tickY) {
           // based on axisFeatureTick(ai, d)
           /** shiftRight moves right end of tick out of axis zone, so it can
            * receive hover events.
            */
           const xOffset = 25, shiftRight=5;
           let ak = axisName,
               sLine = lineHoriz(ak, tickY, xOffset, shiftRight);
           return sLine;
         });
        }
       }
      );
    }

    /** Setup hover info text over scaffold horizTick-s.
     * @see based on similar configureAxisTitleMenu()
     */
    function  configureHorizTickHover(location)
    {
      console.log("configureHorizTickHover", location, this, this.outerHTML);
      /** typeof location may also be "number" or "object" - array : syntenyBlocks[x] */
      let text = (location == "string") ? location :  "" + location;
      let node_ = this;
      Ember.$(node_)
        .popover({
          trigger : "click hover",
          sticky: true,
          delay: {show: 200, hide: 3000},
          container: 'div#holder',
          placement : "auto right",
          /* The popover placement is 65px too high (might depend on window size).
           * As a simple fix, offset was tried with no apparent effect, possibly
           * depends on a recent version.  An alternative would be to use a
           * placement function.
           * offset : "0 65px",
           */
          /* Could show location in content or title; better in content because
           * when content is undefined a small content area is still displayed,
           * whereas undefined title takes no visual space.
           * title : location,
           */
           content : text
        });
    }

//-components/sb

    /*------------------------------------------------------------------------*/
    /** Draw  synteny blocks between adjacent axes.
     *
     * Uses isAdjacent(), which uses adjAxes[], calculated in
     * collateAdjacentAxes(), called via flows.alias : collateStacksA()
     *
     * @param t transition or undefined
     */
    function showSynteny(syntenyBlocks, t)
    {
      /** indexes into the columns of syntenyBlocks[]
       * 0,1 : chr0, chr1
       * 2,3,4,5 : gene 1,2,3,4
       */
      const SB_ID = 6, SB_SIZE = 7;
      let sbS=svgContainer.selectAll("g.synteny")
        .data(["synteny"]), // datum could be used for class, etc
      sbE = sbS.enter()
        .append("g")
        .attr("class", "synteny"),
      sbM = sbE.merge(sbS);
      if (trace_synteny)
        console.log("showSynteny", sbS.size(), sbE.size(), sbM.size(), sbM.node());

      function sbChrAreAdjacent(sb) {
        let a0 = sb[0], a1 = sb[1], adj = isAdjacent(a0, a1);
        return adj;
      }
      function sbSizeFilter(sb) {
        return sb[SB_SIZE] > oa.sbSizeThreshold;
      }
      let adjSynteny = syntenyBlocks.filter(sbChrAreAdjacent)
        .filter(sbSizeFilter);

      function blockLine (s) {
        let sLine = patham2(s[0], s[1], s.slice(2));
        if (trace_synteny > 3)
        console.log("blockLine", s, sLine);
        return sLine;
      }

      function intervalIsInverted(a, d0, d1)
      {
        // could use featureY_(a, d0), if flipping is implemented via scale
        let inverted = oa.z[a][d0].location > oa.z[a][d1].location;
        if (trace_synteny > 3)
          console.log("intervalIsInverted", a, d0, d1, inverted);
        return inverted;
      }
      function syntenyIsInverted(s) {
        let inverted = intervalIsInverted(s[0], s[2], s[3])
          != intervalIsInverted(s[1], s[4], s[5]);
        if (trace_synteny > 3)
          console.log("syntenyIsInverted", s, inverted);
        return inverted;
      }

      function  configureSyntenyBlockHover(sb)
      {
        let j=0, text = axisId2Name(sb[j++]) + "\n" + axisId2Name(sb[j++]);
        for ( ; j < sb.length; j++) text += "\n" + sb[j];
        console.log("configureSyntenyBlockHover", sb, text);
        return configureHorizTickHover.apply(this, [text]);
      }

        let pS = sbM.selectAll("path.syntenyEdge")
          .data(adjSynteny),
        pSE = pS.enter()
          .append("path")
          .attr("class", "syntenyEdge")
          .classed("inverted", syntenyIsInverted)
          .each(configureSyntenyBlockHover),
      pSX = pS.exit(),
        pSM = pSE.merge(pS)
          .attr("d", blockLine);
      pSX.remove();
      if (trace_synteny > 1)
        console.log("showSynteny", syntenyBlocks.length, oa.sbSizeThreshold, adjSynteny.length, pS.size(), pSE.size(), pSX.size(), pSM.size(), pSM.node());
      if (trace_synteny > 2)
        console.log(pSM._groups[0]);

    } // showSynteny()

    /*------------------------------------------------------------------------*/


//-collate (mixin?)
    /** Construct a unique name for a group of aliases - sort the aliases and catenate them.
     */
    function aliasesUniqueName(aliases)
    {
      let s = aliases.sort().join("_");
      aliases.name = s;
      return s;
    }
    let traceCount_featureSet = 0, traceCount_featureIndex = 0;
    /** Ensure that the given feature is referenced in featureIndex[].
     * This is collated in receiveChr(), and should not be needed in
     * collateData(); the purpose of this function is to clarify when & why that
     * is not happening.
     * @param featureId
     * @param featureName
     * @param blockId ID of block which contains feature
     */
    function ensureFeatureIndex(featureId, featureName, blockId)
    {
      if (! isOtherField[featureName]) {
        let f = z[blockId][featureName];
        /* For genetic maps, features (markers) are unique with a chromosome (block) of a map (dataset).
         * For physical maps, they may not be unique, and hence this verification does not apply. 
        if (f.id != featureId)
          breakPoint('ensureFeatureIndex', 'f.id', f.id, '!= featureId', featureId);
         */

        if (! oa.d3FeatureSet.has(featureName))
        {
          if (traceCount_featureSet++ < 5)
            console.log('d3FeatureSet', featureId, featureName);
          oa.d3FeatureSet.add(featureName);
        }
        if (! oa.featureIndex[featureId])
        {
          if (traceCount_featureIndex++ < 5)
            console.log('featureIndex', featureId, featureName);
          oa.featureIndex[featureId] = f;
        }
      }
    };
    /** Lookup the featureName and blockId of featureId,
     * and call @see ensureFeatureIndex().
     * @param featureId
     */
    function featureLookupName(featureId)
    {
      let featureName, f = oa.featureIndex[featureId];
      if (f)
      {
        featureName = f.name;
      }
      else
      {
        let feature = me.get('store').peekRecord('feature', featureId),
        // in console .toJSON() was required - maybe just timing.
        block = feature.get('blockId') || (feature = feature.toJSON()).get('blockId'),
        blockId = block.get('id');
        featureName = feature.get('name');
        ensureFeatureIndex(featureId, featureName, blockId);
      }
      return featureName;
    };

    /** After data is loaded, collate to enable faster lookup in collateStacks() and dragged().
     * for each axis
     *   for each feature
     *     store : ref to parent axis       .axis
     *     store : feature -> array of Axes (or set)  features[feature] : set of Axes
     *     store       aliasGroup[aliasGroup] : [ feature ] feature references axis and array of aliases
     *     {unique name of alias group (sort) : array of : axis / feature / array of aliases}
     *     for each alias
     *       store axis / alias : feature    axisFeatureAliasToFeature[axis][feature alias] : feature
     *       store axis/feature : alias groups  (or was that alias groups to feature)
     *          z[axis][feature].aliasGroupName (maybe later array [aliasGroup])
     * 
     */
    function collateData()
    {
      d3.keys(oa.z).forEach(function(axis) {
        let za = oa.z[axis];
        // console.log("collateData", axis, za);
        if (featureAliasGroupAxes[axis] === undefined)
          featureAliasGroupAxes[axis] = {};
        let axisFeatureAliasToFeature = oa.axisFeatureAliasToFeature;
        if (axisFeatureAliasToFeature[axis] === undefined)
        {
          axisFeatureAliasToFeature[axis] = {};
        let aafa  = axisFeatureAliasToFeature[axis];
        d3.keys(za).forEach(function(feature) {
          if ((feature != "mapName") && (feature != "chrName")
              && ! isOtherField[feature])
          {
          try
          {
            za[feature].axis = z[axis]; // reference from feature to parent axis
            // console.log("collateData", axis, za, za[feature]);
          } catch (exc)
          {
            console.log("collateData", axis, za, za[feature], exc);
            breakPoint();
          }
          let featureAxisSets = oa.featureAxisSets;
          if (featureAxisSets[feature] === undefined)
            featureAxisSets[feature] = new Set();
          featureAxisSets[feature].add(axis);

          let feature_ = za[feature], fas = feature_.aliases;
          feature_.name = feature;
          if (fas && fas.length)
          {
            /** Include feature's own name in the name of the group of its
             * aliases, because if aliases are symmetric, then e.g.
             *  map/chr1 : F1  {f2 ,f3 }
             *  map/chr2 : f2  {F1 ,f3 }, f3  {F1 ,f2 }
             * i.e. there is just one alias group : {F1 ,f2 ,f3 }
             * The physical data seems to contain symmetric alias groups of 5-20
             * genes ("features"); so recognising that there is just one alias
             * group can significantly reduce processing and memory.
             */
            let aliasGroupName = aliasesUniqueName(fas.concat([feature]));
            let aliasGroup = oa.aliasGroup;
            if (aliasGroup[aliasGroupName] === undefined)
              aliasGroup[aliasGroupName] = [];
            aliasGroup[aliasGroupName].push(feature_);

            for (let featureAlias of fas)
            {
              // done above, could be moved here, if still required :
              // za[a] = {location: feature_.location};

              if (aafa [featureAlias] === undefined)
                aafa [featureAlias] = [];
              aafa [featureAlias].push(feature);
            }

            if (feature_.aliasGroupName)
              // should be just 1
              console.log("[feature] aliasGroupName", axis, feature, feature_, aliasGroupName);
            else
              feature_.aliasGroupName = aliasGroupName;
          }
            // ensureFeatureIndex(featureID, feature, axis);
          }
        });
        }
      });
    }

    /** Collate the classes of features via alias groups.
     * Inputs : z (including .aliasGroupName), featureScaffold (from colouredFeatures)
     * Outputs : aliasGroupClasses
     */
    function collateFeatureClasses(featureScaffold)
    {
      d3.keys(oa.z).forEach(
        function(axisName)
        {
          let za = oa.z[axisName];
          d3.keys(za).forEach(
            function(featureName)
            {
              if (! isOtherField[featureName])
              {
              let  feature_ = za[featureName],
              aliasGroupName = feature_.aliasGroupName,
              fas = feature_.aliases;
              if (fas && fas.length > 0)
              {
                // fas.length > 0 implies .aliasGroupName is defined
                let agc = aliasGroupClasses[aliasGroupName];
                if (agc === undefined)
                {
                  aliasGroupClasses[aliasGroupName] = new Set();
                  agc = aliasGroupClasses[aliasGroupName];
                }
                // feature_.name === featureName;
                for (let i=0; i<fas.length; i++)
                {
                  let fi = fas[i], className = featureScaffold[fi];
                  if (className)
                    agc.add(className);
                }
              }
              }
            });
        });
    }


    /**             is feature f1  in an alias group of a feature f0  in axis0  ?
     * @return   the matching aliased feature f0  if only 1
     */
    function maInMaAG(axis0, axis1, f1 )
    {
      /** Return the matching aliased feature if only 1; afC is the count of matches */
      let featureToAxis, afC=0;
      /** aafa  inverts the aliases of f1 ; i.e. for each alias fa  of f1 , aafa [fa ] contains f1 .
       * so aafa [f1 ] contains the features which alias to f0 
       * If there are only 1 of those, return it.
       * ?(f1  if f0  is in the aliases of a0:f1 )
       */
      let aafa  = oa.axisFeatureAliasToFeature[axis0.axisName],
      fa  = aafa [f1 ],
      z0 = oa.z[axis0.axisName];
      let afs = [];
      if (fa )
        for (let fai=0; fai<fa .length; fai++)
      {
          let fai_ = fa [fai];
          if (z0[fai_])
          {
            featureToAxis = fai_;
            afC++;
            if (trace_alias > 1)
              afs.push(featureToAxis); // for devel trace.
          }
        }
      if (trace_alias > 1)
        console.log("maInMaAG()", axis0.mapName, axis1.mapName, f1 , featureToAxis, afC, afs);
      if (afC > 1)
        featureToAxis = undefined;
      else if (trace_alias > 1)
      {
        console.log(aafa , fa , z0);
      }
      return featureToAxis;
    }

    /** At time of axis adjacency change, collate data for faster lookup in dragged().
     *
     *   for each pair of adjacent stacks

     *       for each feature in axis
     *         lookup that feature in the other axis directly
     *           store : feature : axis - axis    featureAxes[feature] : [[feature, feature]]
     *         any connection from a0:feature0 to a1 via alias :
     *         lookup that feature in the other axis via inverted aliases
     *           store : alias group : axis/feature - axis/feature   aliasGroupAxisFeatures[aliasGroup] : [feature, feature]  features have refn to parent axis
     *         unique 1:1 connection between a0:feature0 and a1:feature1 :
     *           for each feature, feature1, in AXIS1
     *             consider direct and any alias of a0:feature0
     *             is feature1 in feature0 alias group ?
     *             is feature0 in feature1 alias group ?
     *             (compile hash from each feature alias group)
     *             for axis-axis data is list of ags

     * Results are in pathsUnique, which is accessed via Flow.pathData
     */
    function collateStacks1()
    {
      oa.featureAxes = featureAxes = {};
      aliasGroupAxisFeatures = {};
      pathsUnique = flows.U_alias.pathData = [];
      let stacks = oa.stacks;

      for (let stackIndex=0; stackIndex<stacks.length-1; stackIndex++) {
        let s0 = stacks[stackIndex], s1 = stacks[stackIndex+1],
        fAxis_s0 = s0.childBlocks(),
        fAxis_s1 = s1.childBlocks();
        if (fAxis_s0.length === 0 || fAxis_s1.length === 0)
        {
          console.log("fAxis_s0,1.length", fAxis_s0.length, fAxis_s1.length);
          // stacks.log();
        }
        // Cross-product of the two adjacent stacks
        for (let a0i=0; a0i < fAxis_s0.length; a0i++) {
          let a0 = fAxis_s0[a0i], za0 = a0.z, a0Name = a0.axisName;
          for (let a1i=0; a1i < fAxis_s1.length; a1i++) {
            let a1 = fAxis_s1[a1i], za1 = a1.z || /* mask error in stack.childAxisNames(true) */ oa.z[a1.axisName];
            d3.keys(za0).forEach(function(feature0) {
              if (! isOtherField[feature0])
              {
              /** a0, a1 could be derived from za0[feature0].axis, za1[feature0].axis */
              let faa = [feature0, a0, a1, za0[feature0], za1[feature0]];
              let featureAxes = oa.featureAxes;
              if (za1[feature0])
              {
                if (featureAxes[feature0] === undefined)
                  featureAxes[feature0] = [];
                featureAxes[feature0].push(faa);
                if (trace_path > 3)
                  console.log(feature0, faa);
              }
              // not used yet; to be shared to pathAliasGroup().
              // any connection from a0:feature0 to a1 via alias :
              let aliasGroup = za0[feature0].aliasGroupName;
              if (false && aliasGroup)
              {
                if (aliasGroupAxisFeatures[aliasGroup] === undefined)
                  aliasGroupAxisFeatures[aliasGroup] = [];
                aliasGroupAxisFeatures[aliasGroup].push(faa);
              }

              /* If feature0 is in an alias of a1, 
               * maInMaAG return the feature if just 1
               * 
               */

              let
                aliasedM0,
                aliasedM1 = maInMaAG(a1, a0, feature0),
                isDirect = directWithAliases && oa.z[a1.axisName][feature0] !== undefined;
              let differentAlias;
              if (aliasedM1 || showAsymmetricAliases)
              {
                /* alias group of feature0 may not be the same as the alias group
                 * which links aliasedM1 to a0, but hopefully if aliasedM0 is
                 * unique then it is feature0. */
                aliasedM0 = maInMaAG(a0, a1, aliasedM1);
                /** aliasedM1 is the alias of feature0, so expect that the alias
                 * of aliasedM1 is feature0.  But some data seems to have
                 * asymmetric alias groups.  In that case, we classify the alias
                 * as non-unique. */
                differentAlias = aliasedM0 != feature0;
                if (trace_alias > 1 && differentAlias)
                {
                  let axisFeatureAliasToFeature = oa.axisFeatureAliasToFeature;
                  console.log("aliasedM1", aliasedM1, "aliasedM0", aliasedM0, feature0, za0[feature0], za1[aliasedM1], axisFeatureAliasToFeature[a1.axisName][feature0], axisFeatureAliasToFeature[a0.axisName][aliasedM1]);
                }

                let d0 = feature0, d1 = aliasedM1;

                if (trace_alias > 1)
                  console.log("collateStacks()", d0, d1, a0.mapName, a1.mapName, a0, a1, za0[d0], za1[d1]);

              }
              let
                nConnections = 0 + (aliasedM1 !== undefined) + (isDirect ? 1 : 0);
              if ((nConnections === 1) && (showAsymmetricAliases || (differentAlias !== true))) // unique
              {
                let 
                  /** i.e. isDirect ? feature0 : aliasedM1 */
                  feature1 = aliasedM1 || feature0,
                ffaa = [feature0, feature1, a0, a1];
                pathsUnique.push(ffaa);
                // console.log(" pathsUnique", pathsUnique.length);
              }
              }
            });
          }
        }
      }
      if (pathsUnique)
        console.log("collateStacks", " featureAxes", d3.keys(oa.featureAxes).length, ", pathsUnique", pathsUnique.length);
      if (trace_path > 4)
      {
        for (let featurej in featureAxes) {
          let faNj = featureAxes[featurej];
          console.log("collateStacks1", featurej, faNj.length);
          for (let i = 0; i < faNj.length; i++)
          {
            log_maamm(faNj[i]);
          }
        }
      }
      if (trace_path > 3)
      {
        pathsUnique_log(pathsUnique);
      }
    }
    function pathsUnique_log(pathsUnique)
    {
      if (pathsUnique)
        for (let pi=0; pi<pathsUnique.length; pi++)
      {
          let p = pathsUnique[pi];
          // log_ffaa() give more detail than this.
          // console.log(p[0], p[1], p[2].mapName, p[3].mapName);
          log_ffaa(p);
        }
    }
    /** log content of featureAxes[featureName][i] */
    function log_maamm(f)
    {
      let     [feature0, a0, a1, f0 , f1 ] = f,
      z = oa.z;
      console.log(feature0, a0.mapName, a0.axisName, a1.mapName, a1.axisName, f0 .location, f1 .location);
    }
    function log_ffaa(ffaa)
    {
      if ((ffaa === undefined) || (typeof ffaa == "string") || (ffaa.length === undefined))
        console.log(ffaa);
      else
      {
        let     [feature0, feature1, a0, a1, direction, aliasGroupName] = ffaa,
        z = oa.z,
        f0  = z[a0.axisName][feature0],
        f1  = z[a1.axisName][feature1];
        console.log(feature0, feature1, a0.mapName, a0.axisName, a1.mapName, a1.axisName, f0 .location, f1 .location, direction, aliasGroupName);
      }
    }
    function mmaa2text(ffaa)
    {
      let s = "";
      if ((ffaa === undefined) || (typeof ffaa == "string") || (ffaa.length === undefined))
        s += ffaa;
      else
      {
        let     [feature0, feature1, a0, a1, direction, aliasGroupName] = ffaa,
        z = oa.z,
        f0  = z[a0.axisName][feature0],
        f1  = z[a1.axisName][feature1];
        s += feature0 + ", " + feature1 + ", " + a0.mapName + ", " + a0.axisName + ", " + a1.mapName + ", " + a1.axisName + ", " + f0 .location + ", " + f1 .location + ", " + direction + ", " + aliasGroupName;
      }
      return s;
    }

    /** Collate adjacent Axes, based on current stack adjacencies.
     */
    function collateAdjacentAxes()
    {
      adjAxes = oa.adjAxes = {};
      let stacks = oa.stacks;
      for (let stackIndex=0; stackIndex<stacks.length-1; stackIndex++) {
        let s0 = stacks[stackIndex], s1 = stacks[stackIndex+1],
        fAxis_s0 = s0.childBlocks(),
        fAxis_s1 = s1.childBlocks();
        if (trace_adj > 2)
        {
          console.log('collateAdjacentAxes', stackIndex, fAxis_s0, stackIndex+1, fAxis_s1);
          s0.log(); s1.log();
        }
        // Cross-product of the Axes in two adjacent stacks
        for (let a0i=0; a0i < fAxis_s0.length; a0i++) {
          let a0 = fAxis_s0[a0i], za0 = a0.z, a0Name = a0.axisName;
          if (a0Name === undefined)
          {
            console.log(fAxis_s0, fAxis_s1, a0i, a0);
          }
          for (let a1i=0; a1i < fAxis_s1.length; a1i++) {
            let a1 = fAxis_s1[a1i], za1 = a1.z;
            if (trace_adj > 3)
            {
              console.log(a0i, a0Name, a1i, a1.axisName);
              a0.log();
              a1.log();
            }
            if (adjAxes[a0Name] === undefined)
              adjAxes[a0Name] = [];
            adjAxes[a0Name].push(a1.axisName);
            if (adjacent_both_dir)
            {
              if (adjAxes[a1.axisName] === undefined)
                adjAxes[a1.axisName] = [];
              adjAxes[a1.axisName].push(a0Name);
            }
          }
        }
      }
      if (trace_adj > 1)
        log_adjAxes(adjAxes);
      else if (trace_adj)
        console.log("collateAdjacentAxes", d3.keys(adjAxes).map(Stacked.longName));
    }
    //-gd
    function axisId2Name(axisID)
    {
      let axis = Stacked.getAxis(axisID);
      return axis && axis.mapName;
    }
//-stacks
    function log_adjAxes()
    {
      console.log("adjAxes");
      d3.keys(adjAxes).forEach(function(a0Name) {
        let a0 = adjAxes[a0Name];
        console.log(a0Name, axisId2Name(a0Name), a0.length);
        for (let a1i=0; a1i < a0.length; a1i++) {
          let a1Name = a0[a1i];
          console.log(a1Name, axisId2Name(a1Name));
        }
      });
    }
    function log_adjAxes_a(adjs)
    {
      console.log("adjs", adjs.length);
      for (let a1i=0, a0=adjs; a1i < a0.length; a1i++) {
        let a1Name = a0[a1i];
        console.log(a1Name, axisId2Name(a1Name));
      }
    }
    /** @return true if Axes a0, a1 are adjacent, in either direction. */
    function isAdjacent(a0, a1)
    {
      let result = false, adjs0 = oa.adjAxes[a0];
      if (adjs0)
        for (let a1i=0; (a1i < adjs0.length) && !result; a1i++) {
          result = a1 == adjs0[a1i];
          if (result)
            console.log("isAdjacent", a0, axisId2Name(a0), a1, axisId2Name(a1));
      }
      return result;
    }
//-paths
    /** Check if aliases between axisName and axisName1 have been stored.  */
    function getAliased(axisName, axisName1)
    {
      /* If there are aliases between axisName, axisName1 then
       * aliased[axisName][axisName1] (with apNames in lexicographic
       * order) will be defined, but because some adjacencies may not
       * have aliases, aliasedDone is used.
       */
      let a0, a1;
      if (! adjacent_both_dir && (axisName > axisName1))
      { a0 = axisName1; a1 = axisName; }
      else
      { a0 = axisName; a1 = axisName1; }
      let a = aliasedDone[a0] && aliasedDone[a0][a1];
      if (trace_adj > 1)
      {
        console.log("getAliased filter", axisName, axisId2Name(axisName), axisName1, axisId2Name(axisName1), a);
      }
      if (! a)
      {
        if (aliasedDone[a0] === undefined)
          aliasedDone[a0] = {};
        aliasedDone[a0][a1] = true;
        /* The caller will now calculate aliases locally, and the following requests aliases from the backend.
         * Either of these 2 can be made optional. */
        me.trigger('expose', axisName, axisName1);
      }
      return a;
    }

    /* This has a similar role to collateStacks1(), but is more broad - it just
     * looks at aliases and does not require symmetry; the filter can be customised to
     * require uniqueness, so this method may be as efficient and more general.
     *
     * for asymmetric aliases :
     * for each axis
     *   adjAxes = array (Set?) of adjacent Axes, minus those already in tree[axis0]
     *   for each feature f0  in axis
     *     lookup aliases (features) from f0  (could be to f0 , but seems equiv)
     *       are those aliased features in Axes in adjAxes ?	(use mapping featureAxisSets[featureName] -> Axes)
     *         add to tree, associate duplicates together (coming back the other way)
     *           by sorting axis0 & axis1 in lexicographic order.
     * 	         aliased[axis0][axis1][f0 ][f1 ]  : [f0 , f1 , axis0, axis1, direction, aliasGroupName]
     *
     * call filterPaths() to collate paths of current adjacencies in put, accessed via Flow.pathData
     */
    function collateStacksA()
    {
      collateAdjacentAxes();
      let adjCount = 0, adjCountNew = 0, pathCount = 0;
      d3.keys(oa.z).forEach(
        function(axisName)
        {
          let za = oa.z[axisName];
          let adjs = adjAxes[axisName];
          if (adjs && adjs.length
              &&
              (adjs = adjs.filter(function(axisName1) {
              adjCount++;
              let a = getAliased(axisName, axisName1);
              if (!a) adjCountNew++;
                return ! a; } ))
              &&
              adjs.length)
          {
            if (trace_adj > 1)
            {
              console.log(axisName, axisId2Name(axisName));
              log_adjAxes_a(adjs);
            }
            let trace_count = 1;
            d3.keys(za).forEach(
              function(featureName)
              {
                if (! isOtherField[featureName]) {
                let  feature_ = za[featureName],
                aliasGroupName = feature_.aliasGroupName;

                let fas = feature_.aliases;
                if (fas)
                for (let i=0; i<fas.length; i++)
                {
                  let fi = fas[i],
                  featureAxisSets = oa.featureAxisSets,
                  Axes = featureAxisSets[fi];
                  // Axes will be undefined if fi is not in a axis which is displayed.
                  if (Axes === undefined)
                  {
                    if (trace_adj && trace_count-- > 0)
                      console.log("collateStacksA", "Axes === undefined", axisName, adjs, featureName, feature_, i, fi, featureAxisSets);
                  }
                  else
                    // is there an intersection of adjs with Axes
                    for (let id=0; id<adjs.length; id++)
                  {
                      let aj = adjs[id],
                      featureA = oa.z[aj][fi];
                      if (Axes.has(aj))
                      {
                        let // aliasGroupName = featureA.aliasGroupName,
                          direction = axisName < aj,
                        axes = oa.axes,
                        axisName_ = axes[axisName] || stacks.blocks[axisName],
                        aj_ = axes[aj],
                        featureToAxis = [
                          {f: featureName, axis: axisName_},
                          {f: fi, axis: aj_}
                        ],
                        featureToAxis_= [featureToAxis[1-direction], featureToAxis[0+direction]],
                        [f0 , f1 , axis0, axis1] = [featureToAxis_[0].f, featureToAxis_[1].f, featureToAxis_[0].axis, featureToAxis_[1].axis],
                        ffaa = [f0 , f1 , axis0, axis1, direction, aliasGroupName];
                        if (trace_adj && trace_count-- > 0)
                          console.log("ffaa", ffaa, axis0.axisName, axis1.axisName, axisId2Name(axis0.axisName), axisId2Name(axis1.axisName));
                        // log_ffaa(ffaa);
                        // aliased[axis0][axis1][f0 ][f1 ] = ffaa;
                        /* objPut() can initialise aliased, but that is done above,
                         * needed by filter, so result is not used. */
                        objPut(aliased, ffaa, axis0.axisName, axis1.axisName, f0 , f1 );
                        pathCount++;
                      }
                    }
                }
                }

              });
          }
        });
      if (trace_adj)
        console.log("adjCount", adjCount, adjCountNew, pathCount);
      // uses (calculated in) collateAdjacentAxes() : adjAxes, collateStacksA() : aliased.
      filterPaths();
    }

    function objPut(a, v, k1, k2, k3, k4)
    {
      if (a === undefined)
        a = {};
      let A, A_;
      if ((A = a[k1]) === undefined)
        A = a[k1] = {};
      if ((A_ = A[k2]) === undefined)
        A = A[k2] = {};
      else
        A = A_;
      if ((A_ = A[k3]) === undefined)
        A = A[k3] = {};
      else
        A = A_;
      if ((A_ = A[k4]) === undefined)
        A = A[k4] = [];
      else
        A = A_;
      A.push(v);
      return a;
    }
    /** convert aliases to hover text
     * @param aliases array returned by api/Blocks/paths
     * "they're the complete alias object
     * which is something like {"str1": ..., "str2": ..., "namespace1": ..} "
     */
    function aliasesText(aliases)
    {
      let text = aliases.map(aliasText).join("\n");
      return text;
    }
    function aliasText(alias)
    {
      let text =
        d3.keys(alias).forEach(function(a) {
          return a.toString() + alias[a];
        });
      return text;
    }
    /** Store the results from api/Blocks/paths request, in the same structure,
     * aliased, which collateStacksA() stores in. */
    function addPathsToCollation(blockA, blockB, paths)
    {
      console.log('addPathsToCollation', blockA, blockB, paths.length);
      let axisName = blockA, axisName1 = blockB;
      let trace_count = 1;
      paths.map(function (p) {
        /** example of result : 
         *  {featureA: "5ab0755a3d9b2d6b45839b2f", featureB: "5ab07f5b3d9b2d6b45839b34", aliases: Array(0)}
         * Result contains feature object ids; convert these to names using
         * featureIndex[], as current data structure is based on feature (feature)
         * names - that will change probably. */
        let
        featureName = featureLookupName(p.featureA),
        /** If p.aliases.length == 0, then p is direct not alias so put it in featureAxes[] instead.
         * Will do that in next commit because it is useful in first pass to do visual comparison of
         * paths calculated FE & BE by toggling the flow display enables
         * (div.flowButton / flow.visible) "direct" and "alias".
         */
        aliasGroupName = aliasesText(p.aliases),
        fi = featureLookupName(p.featureB);
      // modified(hacked) copy of code in collateStacksA() above, may factor to re-combine these.
                      let aj = blockB, // adjs[id],
                      featureA = oa.z[aj][fi];
                      // if (Axes.has(aj))
                      {
                        /** store paths in an a canonical order; paths between
                         * blocks are not dependent on order of the adjacent
                         * blocks.
                         */
                        let // aliasGroupName = featureA.aliasGroupName,
                          direction = axisName < aj,
                        blockA_ = oa.stacks.blocks[blockA],
                        blockB_ = oa.stacks.blocks[blockB],
                        /** indexed with direction to produce featureToAxis_[],
                         * from which ffaa is extracted so that .axis0 < .axis1.
                         */
                        featureToAxis = [
                          {f: featureName, axis: blockA_},
                          {f: fi, axis: blockB_}
                        ],
                        featureToAxis_= [featureToAxis[1-direction], featureToAxis[0+direction]],
                        [f0 , f1 , axis0, axis1] = [featureToAxis_[0].f, featureToAxis_[1].f, featureToAxis_[0].axis, featureToAxis_[1].axis],
                        ffaa = [f0 , f1 , axis0, axis1, direction, aliasGroupName];
                        if (trace_adj && trace_count-- > 0)
                          console.log("ffaa", ffaa, axis0.axisName, axis1.axisName, axisId2Name(axis0.axisName), axisId2Name(axis1.axisName));
                        // log_ffaa(ffaa);
                        objPut(aliased, ffaa, axis0.axisName, axis1.axisName, f0 , f1 );
                      }
      });

      filterPaths();
      /* the results can be direct or aliases, so when the directs are put in
       * featureAxes[], then do pathUpdate(undefined); * for now, just the aliases : */
      pathUpdate_(undefined, flows["alias"]);
    }

    /**
     * Results are in put, which is accessed via Flow.pathData
     */
    function filterPaths()
    {
      put = flows.alias.pathData = [];
      function selectCurrentAdjPaths(a0Name)
      {
        // this could be enabled by trace_adj also
        if (trace_path > 1)
          console.log("a0Name", a0Name, axisId2Name(a0Name));
        adjAxes[a0Name].forEach(function (a1Name) { 
          if (trace_path > 1)
            console.log("a1Name", a1Name, axisId2Name(a1Name));
          let b;
          if ((b = aliased[a0Name]) && (b = b[a1Name]))
            d3.keys(b).forEach(function (f0 ) {
              let b0=b[f0 ];
              d3.keys(b0).forEach(function (f1 ) {
                let b01=b0[f1 ];
                let ffaa = b01;
                // filter here, e.g. uniqueness
                if (trace_path > 1)
                {
                  console.log(put.length, f0 , f1 , ffaa.length);
                  log_ffaa(ffaa[0]);
                }
                put.push.apply(put, ffaa);
              });
            });
        });
      };
      if (trace_path > 1)
        console.log("selectCurrentAdjPaths.length", selectCurrentAdjPaths.length);
      d3.keys(adjAxes).forEach(selectCurrentAdjPaths);
      console.log("filterPaths", put.length);
    }

//-collate or gd
    /**
     * compile map of feature -> array of Axes
     *  array of { stack{Axes...} ... }
     * stacks change, but Axes/chromosomes are changed only when page refresh
     */
    function collateFeatureMap()
    {
      console.log("collateFeatureMap()");
      if (featureToAxis === undefined)
        featureToAxis = {};
      featureAliasToAxis || (featureAliasToAxis = {});
      let z = oa.z;
      for (let axis in z)
      {
        for (let feature in z[axis])
        {
          // console.log(axis, feature);
          if (featureToAxis[feature] === undefined)
            featureToAxis[feature] = [];
          featureToAxis[feature].push(axis);
        }
        /* use feature aliases to match makers */
        Object.entries(z[axis]).forEach
        (
          /** feature is the feature name, f is the feature object in z[].  */
          function ([feature, f])
          {
            /** f.aliases is undefined for z entries created via an alias. */
            let a = f.aliases;
            // console.log(feature, a);
            if (a)
              for (let ai=0; ai < a.length; ai++)
            {
                let alias = a[ai];
                // use an arbitrary order (feature name), to reduce duplicate paths
                if (alias < feature)
                {
                  featureAliasToAxis[alias] || (featureAliasToAxis[alias] = []);
                  featureAliasToAxis[alias].push(axis);
                }
              }
          }
        );
      }
    }

//-stacks derived
    /** given 2 arrays of feature names, concat them and remove duplicates */
    function concatAndUnique(a, b)
    {
      let c = a || [];
      if (b) c = c.concat(b);
      let cu = [...new Set(c)];
      return cu;
    }
//-stacks data / collate
    /** Return an array of Axes contain Feature `feature` and are in stack `stackIndex`.
     * @param feature  name of feature
     * @param stackIndex  index into stacks[]
     * @return array of Axes
     */
    function featureStackAxes(feature, stackIndex)
    {
      /** sfi are the Axes selected by feature. */
      let stack = oa.stacks[stackIndex], sfi=concatAndUnique(featureAliasToAxis[feature], featureToAxis[feature]);
      // console.log("featureStackAxes()", feature, stackIndex, sfi);
      let fAxis_s  = sfi.filter(function (axisID) {
        let mInS = stack.contains(axisID); return mInS; });
      // console.log(fAxis_s );
      return fAxis_s ;
    }
    /** A line between a feature's location in adjacent Axes.
     * @param ak1, ak2 block IDs
     * @param d feature name
     */
    function featureLine2(ak1, ak2, d)
    {
      let
        o = oa.o;
      return line([[o[ak1], featureY_(ak1, d)],
                   [o[ak2], featureY_(ak2, d)]]);
    }
    /**  Return the x positions of the given axes; if the leftmost is split, add
     *  its width to the corresponding returned axis position.
     * @param ak1, ak2  axis IDs  (i.e. oa.axes[ak1] is Stacked, not Block)
     * @param cached  true means use the "old" / cached positions o[ak], otherwise use the current scale x(ak).
     * @return 2 x-positions, in an array, in the given order (ak1, ak2).
     */
    function inside(ak1, ak2, cached)
    {
      let xi = cached
        ? [o[ak1], o[ak2]]
        : [x(ak1), x(ak2)],
      /** true if ak1 is left of ak2 */
      order = xi[0] < xi[1],
      /** If the rightmost axis is split it does not affect the endpoint, since its left side is the axis position.
       * This is the index of the left axis. */
      left = order ? 0 : 1,
      akL = order ? ak1 : ak2,
      aL = oa.axes[akL];
      if (aL.extended)
      {
        // console.log("inside", ak1, ak2, cached, xi, order, left, akL);
        xi[left] += aL.extended;
      }
      return xi;
    }
    /** @return a short line segment, length approx 1, around the given point.
     */
    function pointSegment(point)
    {
      let  floor = Math.floor, ceil = Math.ceil,
      s = [[floor(point[0]), floor(point[1])],
               [ceil(point[0]), ceil(point[1])]];
      if (s[0][0] == s[1][0])
        s[1][0] += 1;
      if (s[0][1] == s[1][1])
        s[1][1] += 1;
      return s;
    }
    /** Stacks version of featureLine2().
     * A line between a feature's location in Axes in adjacent Stacks.
     * @param ak1, ak2 axis names, (exist in axisIDs[])
     * @param d1, d2 feature names, i.e. ak1:d1, ak1:d1
     * If d1 != d2, they are connected by an alias.
     */
    function featureLineS2(ak1, ak2, d1, d2)
    {
      let o = oa.o,
      axis1 = Stacked.getAxis(ak1),
      axis2 = Stacked.getAxis(ak2),
      /** x endpoints of the line;  if either axis is split then the side closer the other axis is used.  */
      xi = inside(axis1.axisName, axis2.axisName, true);
      let l;
      if (axis1.perpendicular && axis2.perpendicular)
      { /* maybe a circos plot :-) */ }
      else if (axis1.perpendicular)
      {
        let point = [xi[0] + vc.yRange/2 - featureY_(ak1, d1), featureY_(ak2, d2)];
        l =  line(pointSegment(point));
      }
      else if (axis2.perpendicular)
      {
        let point = [xi[1] + vc.yRange/2 - featureY_(ak2, d2), featureY_(ak1, d1)];
        l =  line(pointSegment(point));
      }
      else
      // o[p], the map location,
      l =  line([
        [xi[0], featureY_(ak1, d1)],
        [xi[1], featureY_(ak2, d2)]]);
      return l;
    }
    /** Show a parallelogram between 2 axes, defined by
     * 4 feature locations in Axes in adjacent Stacks.
     * Like @see featureLineS2().
     * @param ak1, ak2 axis names, (exist in axisIDs[])
     * @param d[0 .. 3] feature names, i.e. ak1:d[0] and d[1], ak2:d[2] and d[3]
     */
    function featureLineS3(ak1, ak2, d)
    {
      let o = oa.o,
      axis1 = Stacked.getAxis(ak1),
      axis2 = Stacked.getAxis(ak2),
      xi = inside(axis1.axisName, axis2.axisName, false),
      oak = xi, // o[ak1], o[ak2]],
      my = [[featureY_(ak1, d[0]), featureY_(ak1, d[1])],
            [featureY_(ak2, d[2]), featureY_(ak2, d[3])]];
      let sLine;

      /** if one of the axes is perpendicular, draw a line segment using the d
       * values of the perpendicular axes as the x values, and the other as the
       * y values. */
      if (axis1.perpendicular && axis2.perpendicular)
      {  }
      else if (axis1.perpendicular)
      {
        xi[0] += vc.yRange/2;
        let s = [[xi[0] - my[0][0], my[1][0]],
                 [xi[0] - my[0][1], my[1][1]]];
        sLine =  line(s);
      }
      else if (axis2.perpendicular)
      {
        xi[1] += vc.yRange/2;
        let s = [[xi[1] - my[1][0], my[0][0]],
                 [xi[1] - my[1][1], my[0][1]]];
        sLine =  line(s);
      }
      else
      {
        let
          p = [[oak[0], featureY_(ak1, d[0])],
           [oak[0], featureY_(ak1, d[1])],
           // order swapped in ak2 so that 2nd point of ak1 is adjacent 2nd point of ak2
           [oak[1], featureY_(ak2, d[3])],
           [oak[1], featureY_(ak2, d[2])],
          ];
        sLine = line(p) + "Z";
      }
      if (trace_synteny > 4)
        console.log("featureLineS3", ak1, ak2, d, oak, /*p,*/ sLine);
      return sLine;
    }

    /** Similar to @see featureLine().
     * Draw a horizontal notch at the feature location on the axis.
     * Used when showAll and the feature is not in a axis of an adjacent Stack.
     * @param ak axisID
     * @param d feature name
     * @param xOffset add&subtract to x value, measured in pixels
     */
    function featureLineS(ak, d, xOffset)
    {
      let akY = featureY_(ak, d);
      let shiftRight = 9;
      let o = oa.o;
      return line([[o[ak]-xOffset + shiftRight, akY],
                   [o[ak]+xOffset + shiftRight, akY]]);
    }
    /** calculate SVG line path for an horizontal line.
     *
     * Currently this is used for paths within axis group elt,
     * which is within stack elt, which has an x translation,
     * so the path x position is relative to 0.
     *
     * @param ak axisID.
     * @param akY Y	position (relative to axis of ak?)
     * @param xOffset add&subtract to x value, measured in pixels
     * Tick length is 2 * xOffset, centred on the axis + shiftRight.
     * @return line path for an horizontal line.
     * Derived from featureLineS(), can be used to factor it and featureLine()
     */
    function lineHoriz(ak, akY, xOffset, shiftRight)
    {
      /** scaled to axis */
      let akYs = oa.y[ak](akY);
      /* If the path was within g.foreground, which doesn't have x translation
       * for the stack, would calculate x position :
       * o = oa.o;  x position of axis ak : o[ak]
       */
      return line([[-xOffset + shiftRight, akYs],
                   [+xOffset + shiftRight, akYs]]);
    }
    /** Similar to @see featureLine2().
     * Only used in path_pre_Stacks() which will is now discarded;
     * the apparent difference is the param xOffset, to which path_pre_Stacks()
     * passed 5.
     * @param ak blockId containing feature
     * @param d feature name
     * @param xOffset add&subtract to x value, measured in pixels
     */
    function featureLine(ak, d, xOffset)
    {
      let
      akY = featureY_(ak, d);
      let o = oa.o;
      return line([[o[ak]-xOffset, akY],
                   [o[ak]+xOffset, akY]]);
    }
//- collate
    /**
     * change to use feature alias group as data of path;
     *  for non-aliased features, data remains as feature - unchanged
     * 
     * when stack adjacency changes (i.e. drop in/out, dragended) :
     * 
     * compile a list, indexed by feature names,
     *   array of
     *     axis from / to (optional : stack index from / to)
     * 
     * compile a list, indexed by feature alias group names (catenation of aliased feature names),
     *   feature name
     *   array of
     *     axis from / to (optional : stack index from / to)
     * 
     * I think these will use 2 variants of featureStackAxes() : one using featureToAxis[] and the other featureAliasToAxis[].
     * Thinking about what the hover text should be for paths drawn due to an alias - the alias group (all names), or maybe the 2 actual features.
     * that is why I think I'll need 2 variants.
     * 
     * path()
     *   based on the current path(), retain the part inside the 3rd nested for();
     *   the remainder (outer part) is used to as the basis of the above 2 collations.
     * 
     * More detail in collateData() and collateStacks().
     */

    /** Replaced by collateStacks(). */
    function collateMagm(d) // d is featureName
    {
      /* This method originated in path(featureName), i.e. it starts from a given featureName;
       * in next version this can be re-written to walk through :
       *  all adjacent pairs of stacks  :
       *   all Axes of those stacks :
       *    all features of those Axes
       */
      for (let stackIndex=0; stackIndex<oa.stacks.length-1; stackIndex++) {
        let fAxis_s0 = featureStackAxes(d, stackIndex),
        fAxis_s1 = featureStackAxes(d, stackIndex+1);
        // Cross-product of the two adjacent stacks; just the Axes which contain the feature.
        for (let a0i=0; a0i < fAxis_s0.length; a0i++) {
          let a0 = fAxis_s0[a0i];
          for (let a1i=0; a1i < fAxis_s1.length; a1i++) {
            let a1 = fAxis_s1[a1i];
            if (featureAliasGroupAxes[d] === undefined)
              featureAliasGroupAxes[d] = [];
            featureAliasGroupAxes[d].push([stackIndex, a0, a1]);
          }
        }
      }
    }

//- paths
    /** This is the stacks equivalent of path() / zoompath().
     * Returns an array of paths (links between Axes) for a given feature.
     */
    function path(featureName) {
      let r = [];
      // TODO : discard features of the paths which change
      // pathFeatures = {};

      /** 1 string per path segment */
      let
        ffNf = oa.featureAxes[featureName];
      if (ffNf !== undefined)
        /* console.log("path", featureName);
         else */
        if ((unique_1_1_mapping === 2) && (ffNf.length > 1))
      { /* console.log("path : multiple", featureName, ffNf.length, ffNf); */ }
      else
        for (let i=0; i < ffNf.length; i++)
      {
          let [featureName, a0_, a1_, za0, za1] = ffNf[i];
          let a0 = a0_.axisName, a1 = a1_.axisName;
          if ((za0 !== za1) && (a0 == a1))
            console.log("path", i, featureName, za0, za1, a0, a1);
          r[i] = patham(a0, a1, featureName, undefined);
        }
      if (trace_path > 3)
        console.log("path", featureName, ffNf, r);
      if (r.length == 0)
        r.push("");
      return r;
    }

    /** for unique paths between features, which may be connected by alias,
     * data is [feature0, feature1, a0, a1]
     * Enabled by unique_1_1_mapping.
     * @param ffaa  [feature0, feature1, a0, a1]
     */
    function pathU(ffaa) {
      if ((ffaa === undefined) || (ffaa.length === undefined))
      { console.log("pathU", this, ffaa); breakPoint(); }
      let [feature0, feature1, a0, a1] = ffaa;
      let p = [];
      p[0] = patham(a0.axisName, a1.axisName, feature0, feature1);
      if (trace_path > 1)
        console.log("pathU", ffaa, a0.mapName, a1.mapName, p[0]);
      return p;
    }
    function pathUg(d) {
      let ffaa = dataOfPath(this),
      p = pathU(ffaa);
      if (trace_path > 2)
        console.log(this, d);
      return p;
    }

    /** TODO : for paths with alias group as data
     * @param aliasGroup   alias group (name)?
     */
    function pathAliasGroup(aliasGroup) {
      /** 1 string per path segment */
      let p = [],
      agafa = aliasGroupAxisFeatures[aliasGroup]; // to be passed from collateStacks().
      if (agafa === undefined)
        console.log("pathAliasGroup", aliasGroup);
      else
        for (let i=0; i < agafa.length; i++)
      {
          let [featureName, a0, a1, za0, za1] = agafa[i];
          p[i] = patham(a0.axisName, a1.axisName, featureName, undefined);
        }
      return p.join();
    }

    /** Calculate relative location of feature featureName in the axis axisID, and
     * check if it is inRange 
     * @param axisID  ID of Axis Piece
     * @param featureName  feature within axisID
     * @param range e.g. [0, yRange]
     */
    function inRangeI(axisID, featureName, range)
    {
      return inRange(featureY_(axisID, featureName), range);
    }

//- paths-text
    /** @param f  feature reference i.e. z[axisName][featureName]]
     * @return text for display in path hover tooltip */
    function featureAliasesText(fName, f)
    {
      let
        fas = f.aliases,
      s = fName + ":" + (fas ? f.aliases.length : "") + ":";
      if (fas)
      for (let i=0; i<fas.length; i++)
      {
        s += fas[i] + ",";
      }
      // console.log("featureAliasesText", fName, f, fas, s);
      return s;
    }

    /** Prepare a tool-tip for the line.
     * The line / path may be either connecting 2 axes, or a tick on one axis;
     * in the latter case fa1 will be undefined.
     * @param sLine svg path text
     * @param d0, d1 feature names, i.e. a0:f0 , a1:f1 .
     * Iff d1!==undefined, they are connected by an alias.
     * @param fa0, fa1  feature objects.
     * fa1 will be undefined when called from axisFeatureTick()
     */
    function pathFeatureStore(sLine, d0, d1, fa0, fa1)
    {
      let pathFeatures = oa.pathFeatures;
      if (pathFeatures[sLine] === undefined)
        pathFeatures[sLine] = {};

      /** Show the x,y coords of the endpoints of the path segment.  Useful during devel. */
      const showHoverLineCoords = false;
      const showHoverAliases = true;
      /** 1 signifies the normal behaviour - handleMouseOver() will show just the feature name.
       * Values other than 1 will be appended as text. */
      let hoverExtraText = showHoverExtraText ?
        " " + fa0.location +
        (fa1 ?  "-" + fa1.location : "")
        + (showHoverLineCoords ? " " + sLine : "")
      : 1;
      if (showHoverExtraText && showHoverAliases)
      {
        hoverExtraText += 
          "<div>" + featureAliasesText(d0, fa0) + "</div>" +
          (d1 && fa1 ? 
           "<div>" + featureAliasesText(d1, fa1) + "</div>" : "");
      }
      // these are split (at ",") when assigned to hoverFeatures
      let d = d1 && (d1 != d0) ? d0 + "," + d1: d0;
      pathFeatures[sLine][d] = hoverExtraText; // 1;
    }

    /**
     * @param  a0, a1  axis names
     * @param d0, d1 feature names, i.e. a0:d0, a1:d1.
     * Iff d1!==undefined, they are connected by an alias.
     */
    function patham(a0, a1, d0, d1) {
      // let [stackIndex, a0, a1] = featureAliasGroupAxes[d];
      let r;

      let range = [0, vc.yRange];

      /** if d1 is undefined, then its value is d0 : direct connection, not alias. */
      let d1_ = d1 || d0;
      /** Filter out those paths that either side locates out of the svg. */
      let
          inRangeLR = 
            [inRangeI(a0, d0, range), 
             inRangeI(a1, d1_, range)],
        lineIn = allowPathsOutsideZoom ||
            (inRangeLR[0]
             && inRangeLR[1]);
      // console.log("path()", stackIndex, a0, allowPathsOutsideZoom, inRangeI(a0), inRangeI(a1), lineIn);
      if (lineIn)
      {
        let sLine = featureLineS2(a0, a1, d0, d1_);
        let cmName = oa.cmName;
        let feature0 = d0, feature1 = d1,
        /** used for targeted debug trace (to filter, reduce volume)
         * e.g. = feature0 == "featureK" && feature1 == "featureK" &&
         cmName[a0].mapName == "MyMap5" && cmName[a1].mapName == "MyMap6"; */
        traceTarget = false;
        if (traceTarget)
        {
          console.log("patham()", d0, d1, cmName[a0].mapName, cmName[a1].mapName, a0, a1, z[a0][d0].location, d1 && z[a1][d1].location, sLine);
        }
        else if (trace_path > 4)
          console.log("patham()", d0, d1, cmName[a0] && cmName[a0].mapName, cmName[a1] && cmName[a1].mapName, a0, a1, z && z[a0] && z[a0][d0] && z[a0][d0].location, d1 && z && z[a1] && z[a1][d1] && z[a1][d1].location, sLine);          
        r = sLine;
        let z = oa.z;
        if (pathDataIsLine)
          /* Prepare a tool-tip for the line. */
          pathFeatureStore(sLine, d0, d1, z[a0][d0], z[a1][d1_]);
      }
      else if (oa.drawOptions.showAll) {
        const featureTickLen = 10; // orig 5
        function axisFeatureTick(ai, d) {
          let z = oa.z;
          if (d in z[ai])
          {
            r = featureLineS(ai, d, featureTickLen);
            pathFeatureStore(r, d, d, z[ai][d], undefined);
          }
        }
        // Filter these according to inRangeI() as above : return 0 or 1 ticks, not 2 because at least one is out of range.
          if (inRangeLR[0])
              axisFeatureTick(a0, d0);
          if (inRangeLR[1])
              axisFeatureTick(a1, d1_);
      }
      return r;
    }
    /** patham() draws a line (1-d object),  patham2 draws a parallelogram (2-d object).
     * @param  a0, a1  axis names
     * @param d[0 .. 3], feature names, i.e. a0:d[0]-d[1], a1:d[2]-d[3].
     * Unlike patham(), d does not contain undefined.
     */
    function patham2(a0, a1, d) {
      let r;
      let range = [0, vc.yRange];

      /** Filter out those parallelograms which are wholly outside the svg, because of zooming on either end axis. */
      let lineIn = allowPathsOutsideZoom ||
        (inRangeI(a0, d[0], range)
         || inRangeI(a0, d[1], range)
         || inRangeI(a1, d[2], range)
         || inRangeI(a1, d[3], range));
      if (lineIn)
      {
        let sLine = featureLineS3(a0, a1, d);
        let cmName = oa.cmName;
        if (trace_synteny > 4)
          console.log("patham2()", d, cmName[a0] && cmName[a0].mapName, cmName[a1] && cmName[a1].mapName, a0, a1, z && z[a0] && z[a0][d[0]] && z[a0][d[0]].location, d[2] && z && z[a1] && z[a1][d[2]] && z[a1][d[2]].location, sLine);          
        r = sLine;
      }
      /* for showAll, perhaps change the lineIn condition : if one end is wholly
       * in and the other wholly out then show an open square bracket on the
       * axis which is in. */

      return r;
    }


    /** Calculate relative feature location in the axis.
     * Result Y is relative to the stack, not the axis,
     * because .foreground does not have the axis transform (Axes which are ends
     * of path will have different Y translations).
     *
     * @param axisID name of axis or block  (if it is an axis it will be in axisIDs[])
     * This parameter is the difference with the original featureY() which this function replaces.
     * @param d feature name
     */
    function featureY_(axisID, d)
    {
      // z[p][f].location, actual position of feature f in the axis p, 
      // y[p](z[p][f].location) is the relative feature position in the svg
      // ys is used - the y scale for the stacked position&portion of the axis.
      let parentName = Block.axisName_parent(axisID),
      ysa = oa.ys[parentName],
      /** if d is object ID instead of name then featureIndex[] is used */
      feature = oa.z[axisID][d], // || oa.featureIndex[d],
      aky = ysa(feature.location),
      /**  parentName not essential here because yOffset() follows .parent */
      axisY = oa.stacks.blocks[axisID].yOffset();
      // can use parentName here, but initially good to have parent and child traced.
      if (trace_scale_y && ! tracedAxisScale[axisID])
      {
        tracedAxisScale[axisID] = true;
        let yDomain = ysa.domain();
          console.log("featureY_", axisID,  axisName2MapChr(axisID), d,
                      z[axisID][d].location, aky, axisY, yDomain, ysa.range());
      }
      return aky + axisY;
    }



//- axis-brush-zoom
    /** Used when the user completes a brush action on the axis axis.
     * The datum of g.brush is the ID/name of its axis, call this axisID.
     * If null selection then remove axisID from selectedAxes[], otherwise add it.
     * Update selectedFeatures{}, brushedRegions{} : if selectedAxes[] is empty, clear them.
     * Otherwise, set brushedRegions[axisID] to the current selection (i.e. of the brush).
     * Set brushExtents[] to the brushedRegions[] of the Axes in selectedAxes[].
     * For each axis in selectedAxes[], clear selectedFeatures{} then store in it the
     * names + locations of features which are within the brush extent of the axis.
     * Add circle.axisID for those feature locations.
     * Remove circles of features (on all Axes) outside brushExtents[axisID].
     * For elements in '.foreground > g.flowName > g', set class .faded iff the feature (which
     * is the datum of the element) is not in the selectedFeatures[] of any axis.
     *
     * Draw buttons to zoom to the brushExtents (zoomSwitch) or discard the brush : resetSwitch.
     * Called from brushended(), which is called on(end) of axis brush.
     *
     * @param that  the brush g element.
     * The datum of `that` is the name/ID of the axis which owns the brushed axis.
     * 
     */
    function brushHelper(that) {
      // Chromosome name, e.g. 32-1B
      /** name[0] is axisID of the brushed axis. name.length should be 1. */
      let name = d3.select(that).data();
      let brushedAxisID = name[0];
      me.send('selectChromById', brushedAxisID);

      let svgContainer = oa.svgContainer;
      //Remove old circles.
      svgContainer.selectAll("circle").remove();
      let brushedRegions = oa.brushedRegions;
      let brushRange = d3.event.selection,
      mouse = d3.mouse(that);
      let brushSelection = d3.brushSelection(d3.select(that));
      let brush_ = that.__brush,
      brushSelection_ = brush_.selection,
      brushExtent_ = brush_.extent;

      if (trace_gui)
        console.log("brushHelper", that, brushedAxisID, selectedAxes, brushRange, brushedRegions,
                    brushSelection, mouse,
                    brushSelection_ ? '' + brushSelection_[0] + '' + brushSelection_[1] : '', ', ',
                    brushExtent_ ? '' + brushExtent_[0] + ',' + brushExtent_[1] : ''
                   );

      /* d3.event.selection is null when brushHelper() is called via zoom() ... brush.move.
       * This causes selectedAxes to update here; when an axis is zoomed its brush is removed.
       */
      if (brushRange == null) {
        selectedAxes.removeObject(name[0]);
      }
      else {
        selectedAxes.addObject(name[0]); 
      }

      // selectedAxes is an array containing the IDs of the Axes that
      // have been selected.
      
      if (selectedAxes.length > 0) {
        console.log("Selected: ", " ", selectedAxes.length);
        // Axes have been selected - now work out selected features.
        if (brushRange === null)
          delete brushedRegions[brushedAxisID];
        else
          brushedRegions[brushedAxisID] = brushRange;
        /** Extent of current brush (applied to y axis of a axis). */
        let
        brushExtents = selectedAxes.map(function(p) { return brushedRegions[p]; }); // extents of active brushes

        selectedFeatures = {};
        /** selectedFeaturesSet contains feature f if selectedFeatures[d_b][f] for any dataset/block d_b.
         * This is used to efficiently implement featureNotSelected2() which implements .faded.
         */
        let selectedFeaturesSet = new Set();
        /**
         * @param p an axis selected by a current user brush
         * @param i index of the brush of p in brushExtents[]
         */
        selectedAxes.forEach(function(p, i) {
          /** d3 selection of one of the Axes selected by user brush on axis. */
          let axisS = oa.svgContainer.selectAll("#" + eltId(p));
          /** compound name dataset:block (i.e. map:chr) for the selected axis p.  */
          let mapChrName = axisName2MapChr(p);
          selectedFeatures[mapChrName] = [];
          let enable_log = brushExtents[i] === undefined;
            if (enable_log)
            console.log("brushHelper", p, i);

          let yp = oa.y[p],
          axis = oa.axes[p],
          brushedDomain = brushExtents[i].map(function(ypx) { return yp.invert(ypx /* *axis.portion */); });
          if (axis.flipped)
          {
            let swap = brushedDomain[0];
            brushedDomain[0] = brushedDomain[1];
            brushedDomain[1] = swap;
          }

          if (enable_log)
            console.log("brushHelper", name, p, yp.domain(), yp.range(), brushExtents[i], axis.portion, brushedDomain);

          /** for all blocks in the axis */
          let childBlocks = axis.dataBlocks();
          console.log(axis, 'childBlocks', childBlocks);
          childBlocks.map(function (block) {
            let blockFeatures = oa.z[block.axisName]; // or block.get('features')
          d3.keys(blockFeatures).forEach(function(f) {
            let fLocation;
            if (! isOtherField[f] && ((fLocation = blockFeatures[f].location) !== undefined))
            {
            if ((fLocation >= brushedDomain[0]) &&
                (fLocation <= brushedDomain[1])) {
              //selectedFeatures[p].push(f);
              selectedFeaturesSet.add(f);
              selectedFeatures[mapChrName].push(f + " " + fLocation);
              /** Highlight the features in the brushed regions
               * o[p] : the axis location;  now use 0 because the translation of parent g.axis-outer does x offset of stack.
               * fLocation :  actual feature position in the axis, 
               * yp(fLocation) :  is the relative feature position in the svg
               */
              let dot = axisS
                .append("circle")
                .attr("class", eltClassName(f))
                .attr("cx",0)   /* was o[p], but g.axis-outer translation does x offset of stack.  */
                .attr("cy", yp(fLocation))
                .attr("r",2)
                .style("fill", "red");
              brushEnableFeatureHover(dot);
              
            } else {
              let f_ = eltClassName(f);
              axisS.selectAll("circle." + f_).remove();
            }
            }
          });
          });
        });
        sendUpdatedSelectedFeatures();

        function featureNotSelected2(d)
        {
          let sel =
            unique_1_1_mapping && (typeof d != 'string') ?
            ( selectedFeaturesSet.has(d[0]) ||
              selectedFeaturesSet.has(d[1]) )
            : selectedFeaturesSet.has(d);
          /* if (sel)
            console.log("featureNotSelected2", unique_1_1_mapping, d, selectedFeaturesSet); */
          return ! sel;
        }

        d3.selectAll(".foreground > g > g").classed("faded", featureNotSelected2);

        /** d3 selection of the brushed axis. */
        let axisS = svgContainer.selectAll("#" + eltId(name[0]));
        let zoomSwitchS = axisS
          .selectAll('g.btn')
          .data([1]);
        let zoomSwitchE = zoomSwitchS
          .enter()
          .append('g')
          .attr('class', 'btn')
          .attr('transform', yAxisBtnScale);
        zoomSwitchE.append('rect');
        zoomSwitch = zoomSwitchS.merge(zoomSwitchE);
        let zoomResetSwitchTextE =
          zoomSwitchE.append('text')
          .attr('x', 30).attr('y', 20);
        let zoomResetSwitchText =
        zoomSwitch.selectAll('text')
          .text('Zoom');
        
        zoomSwitch.on('mousedown', function () {
          d3.event.stopPropagation();
        });
        zoomSwitch.on('click', function () {
          d3.event.stopPropagation();
          zoom(that,brushExtents);
          zoomed = true;

          //reset function
          //Remove all the existing circles
          oa.svgContainer.selectAll("circle").remove();
          zoomResetSwitchText
            .text('Reset');

          resetSwitch = zoomSwitch;
          resetSwitch.on('click',function(){resetZoom(brushedAxisID);
          });
          /* this need only be set once, can be set outside this callback.
           * for that, resetZoom() can be moved out of brushHelper():zoomSwitch.on()
           */
          me.set('resetZooms', function(features) {
            resetZoom();
          });
          /** Reset 1 or all zooms.
           * @param axisID  axis id to reset; undefined means reset all zoomed axes.
           */
          function resetZoom(axisID)
          {
            let svgContainer = oa.svgContainer;
            let t = svgContainer.transition().duration(750);
            let axisIDs = axisID ? [axisID] : oa.stacks.axisIDs();
            axisIDs.forEach(function(d) {
              let idName = axisEltId(d); // axis ids have "a" prefix
                if (d != axisID)
                  console.log('resetZoom', d, axisID);
              let a = oa.axes[d],
              domain = a.parent ? a.parent.domain : a.getDomain();
              domain = maybeFlip(domain, a.flipped);
              oa.y[d].domain(domain);
              oa.ys[d].domain(domain);
              let yAxis = d3.axisLeft(oa.y[d]).ticks(10);
              oa.svgContainer.select("#"+idName).transition(t).call(yAxis);
            });
            let axisTickS = svgContainer.selectAll("g.axis > g.tick > text");
            axisTickS.attr("transform", yAxisTicksScale);
            axisStackChanged(t);
            me.trigger("zoomedAxis", [axisID, t]);

            pathUpdate(t);
            let resetScope = axisID ? axisS : svgContainer;
              resetScope.selectAll(".btn").remove();
            if (axisID === undefined)
            {
              // reset zoom of all axes clears selectedFeatures - check if this was the intention; also should selectedAxes be cleared ?
              selectedFeatures_clear();
            }
            zoomed = false; // not used
          }
        });
        
      } else {
        // brushHelper() is called from brushended() after zoom, with selectedAxes.length===0
        // At this time it doesn't make sense to remove the resetSwitch button

        // No axis selected so reset fading of paths or circles.
        console.log("brushHelper", selectedAxes.length);
        // some of this may be no longer required
        if (false)
          svgContainer.selectAll(".btn").remove();
        svgContainer.selectAll("circle").remove();
        d3.selectAll(".foreground > g > g").classed("faded", false);
        selectedFeatures_clear();
        brushedRegions = oa.brushedRegions = {};
      }

    } // brushHelper

    let targetIdCount = 0;
    function handleFeatureCircleMouseOver(d, i)
    {
      let
      /** d is the axis chromosome id */
        chrName = d,
      featureName = this.classList[0],
      hoverFeatures = featureName ? [featureName] : [];
      if (oa.drawOptions.showCircleHover)
      {
        let
          selector = "g.axis-outer#" + eltId(chrName) + " > circle." + featureName,
        targetId = "MC_" + ++targetIdCount;
        console.log("handleFeatureCircleMouseOver", d, featureName, selector, targetId);
        if (false)
        {
          d3.select(selector)
            .attr('id', targetId);  // will add selector support to ember-tooltip targetId
        }
        else
        {
          toolTip.html('<span id="AxisCircleHoverTarget">AxisCircleHoverTarget</span>');
          toolTip.show(d, i);
          targetId = "devel-visible";
        }
      }
      //  me.set("axisFeatureTargetId", targetId);
      Ember.run.once(function() {
        me.set("hoverFeatures", hoverFeatures);
        // me.set("axisFeatureCircleHover", true);
      });
    }
    function handleFeatureCircleMouseOut(d, i)
    {
      if (false)
      Ember.run.debounce(
        function() {
          me.set("axisFeatureCircleHover", false);
        },
        10000);
      else
      {
        function hidePathHoverToolTip() { toolTip.hide(d); }
        Ember.run.debounce(hidePathHoverToolTip, 1000);
      }
    }
    function brushEnableFeatureHover(circleSelection)
    {
      circleSelection
        .on("mouseover", handleFeatureCircleMouseOver)
        .on("mouseout", handleFeatureCircleMouseOut);
    }


    /** Zoom the y axis of this axis to the given brushExtents[].
     * Called via on(click) of brushHelper() Zoom button (zoomSwitch).
     * Traverse selected Axes, matching only the axisName of the brushed axis.
     * Set the y domain of the axis, from the inverse mapping of the brush extent limits.
     * Remove the zoom button, redraw the axis, ticks, zoomPath. Move the brush.
     * @param that  the brush g element.
     * The datum of `that` is the name of the axis which owns the brushed axis.
     * @param brushExtents  limits of the current brush, to which we are zooming
     */
    function zoom(that, brushExtents) {
      let axisName = d3.select(that).data();
      if (axisName.length == 1)
        axisName = axisName[0];
      let t = oa.svgContainer.transition().duration(750);
      selectedAxes.map(function(p, i) {
        if(p == axisName){
          let y = oa.y, svgContainer = oa.svgContainer;
          // possibly selectedAxes changed after this callback was registered
          // The need for brushExtents[] is not clear; it retains earlier values from brushedRegions, but is addressed relative to selectedAxes[].
          if (brushExtents[i] === undefined)
          {
            console.log("zoom() brushExtents[i]===undefined", axisName, p, i, "use", brushedRegions[p]);
            brushExtents[i] = brushedRegions[p];
          }
          let yp = y[p],
          axis = oa.axes[p],
          brushedDomain = brushExtents[i].map(function(ypx) { return yp.invert(ypx /* *axis.portion*/); });
          // brushedDomain = [yp.invert(brushExtents[i][0]), yp.invert(brushExtents[i][1])];
          console.log("zoom", axisName, p, i, yp.domain(), yp.range(), brushExtents[i], axis.portion, brushedDomain);
          y[p].domain(brushedDomain);
          oa.ys[p].domain(brushedDomain);
          axisScaleChanged(p, t, true);
          // `that` refers to the brush g element
          d3.select(that).call(y[p].brush.move,null);
        }
      });
      axisStackChanged(t);
      me.trigger("zoomedAxis", [axisName, t]);
    }
    /** @param p  axisName
     * @param updatePaths true : also update foreground paths.
     */
    function axisScaleChanged(p, t, updatePaths)
    {
      let y = oa.y, svgContainer = oa.svgContainer;
      let yp = y[p],
      axis = oa.axes[p];
      let yAxis = d3.axisLeft(y[p]).ticks(axisTicks * axis.portion);
      let idName = axisEltId(p);
      svgContainer.select("#"+idName).transition(t).call(yAxis);
      if (updatePaths)
        pathUpdate(t);

      let axisGS = svgContainer.selectAll("g.axis#" + axisEltId(p) + " > g.tick > text");
      axisGS.attr("transform", yAxisTicksScale);
    }

    function brushended() {
      // console.log("brush event ended");
      brushHelper(this);
    }


//- stacks-drag
    function dragstarted(start_d /*, start_index, start_group*/) {
      Stack.currentDrop = undefined;
      Stack.currentDrag = start_d;
      // unique_1_1_mapping = me.get('isShowUnique'); // disable until button click does not redraw all.
      /** disable this as currently togglePathColourScale() sets pathColourScale as a boolean
       * maybe have a pull-down selector because multi-value.
       use_path_colour_scale = me.get('pathColourScale'); */
      console.log("dragstarted", this, start_d/*, start_index, start_group*/);
      let cl = {/*self: this,*/ d: start_d/*, index: start_index, group: start_group, axisIDs: axisIDs*/};
      let svgContainer = oa.svgContainer;
      svgContainer.classed("axisDrag", true);
      d3.select(this).classed("active", true);
      console.log(d3.event.subject.fx, d3.event.subject.x);
      d3.event.subject.fx = d3.event.subject.x;
      let axisS = svgContainer.selectAll(".stack > .axis-outer");
      if (axisS && trace_stack >= 1.5)
        logSelection(axisS);
      /* Assign class current to dropTarget-s depending on their relation to drag subject.
       add class 'current' to indicate which zones to get .dragHover
       axis being dragged does not get .current
       middle targets on side towards dragged axis don't
       axes i in 1..n,  dragged axis : dg
       current if dg != i && (! middle || ((side == left) == (i < dg)))
       * for (i < dg), use x(d) < startx
       */
      axisS.selectAll('g.axis-outer > g.stackDropTarget').classed
      ("current",
       function(d /*, index, group*/)
       {
         let xd = x(d),
         /** d3.event has various x,y values, which are sufficient for this
          * purpose, e.g. x, subject.x, sourceEvent.clientX, sourceEvent.x */
         startX = d3.event.x,
         middle = this.classList.contains("middle"),
         left = this.classList.contains("left"),
         isCurrent =
           (d != cl.d) &&  (! middle || ((left) === (xd < startX)));
         // console.log("current classed", this, d3.event, d, /*index, group,*/ cl, xd, startX, middle, left, isCurrent);
         return isCurrent;
       });
    }

    /** @param  d (datum) name of axis being dragged.
     */
    function dragged(d) {
      /** Transition created to manage any changes. */
      let t;
      /** X distance from start of drag */
      let xDistance;
      let currentDropTarget = oa.currentDropTarget;
      if (dragging++ > 0) { console.log("dragged drop", dragging); dragging--; return;}
      if (! oa.svgContainer.classed("dragTransition"))
      {
        // if cursor is in top or bottom dropTarget-s, stack the axis,
        // otherwise set axis x to cursor x, and sort.
        let dropTargetEnd = currentDropTarget && currentDropTarget.classList.contains("end");

        const dropDelaySeconds = 0.5, milli = 1000;
        /** currentDrop references the axisName being dragged and the stack it is dropped into or out of. */
        let currentDrop = Stack.currentDrop,
        /** Use the start of the drag, or the most recent drop */
        xDistanceRef = (currentDrop && currentDrop.x) ? currentDrop.x.stack : d3.event.subject.fx,
        now = Date.now();
        if (trace_drag)
        {
          console.log("dragged xDistanceRef", d3.event.x, currentDrop && currentDrop.x, xDistanceRef);
          console.log("dragged", currentDrop, d);
        }
        /** true iff currentDrop is recent */
        let recentDrop = currentDrop && (now - currentDrop.dropTime < dropDelaySeconds * milli);

        if (true && recentDrop && dropTargetEnd)
        {
          console.log("dragged", currentDrop, currentDropTarget, now - currentDrop.dropTime);
        }
        if (! recentDrop)
        {
          if (dropTargetEnd)
          {
            let targetAxisName = currentDropTarget.axisName,
            top = currentDropTarget.classList.contains("top"),
            zoneParent = Stack.axisStackIndex2(targetAxisName);
            /** destination stack */
            let stack = oa.stacks[zoneParent.stackIndex];
            if (! stack.contains(d))
            {
              t = dragTransitionNew();
              /*  .dropIn() and .dropOut() don't redraw the stacks they affect (source and destination), that is done here,
               * with this exception : .dropIn() redraws the source stack of the axis.
               */
              stack.dropIn(d, zoneParent.axisIndex, top, t);
              breakPointEnableSet(1);
              deleteAfterDrag();
              // axisChangeGroupElt(d, t);
              collateStacks();
              // number of stacks has decreased - not essential to recalc the domain.
              Stack.log();
              stack.redraw(t);
            }
            // set x of dropped axisID
          }
          // For the case : drag ended in a middle zone (or outside any DropTarget zone)
          // else if d is in a >1 stack then remove it else move the stack
          else if ((! currentDrop || !currentDrop.out)
                   && ((xDistance = Math.abs(d3.event.x - xDistanceRef)) > vc.xDropOutDistance))
          {
            /** dragged axis, source stack */
            let axis = oa.axes[d], stack = axis.stack;
            if (currentDrop && currentDrop.stack !== stack)
            {
              console.log("dragged", d, currentDrop.stack, stack);
            }
            if (stack.axes.length > 1)
            {
              t = dragTransitionNew();
              stack.dropOut(d);
              Stack.log();
              // axisChangeGroupElt(d, t);
              collateStacks();
              /* if d is not in currentDrop.stack (=== stack), which would be a
               * program error, dropOut() could return false; in that case stack
               * redraw() may have no effect.
               */
              stack.redraw(t);
              /* if axis is dropped out to a new stack, redraw now for
               * continuity, instead of waiting until dragended().
               */
              axisRedrawText(axis);
              /* Following code will set o[d] and sort the Stack into location. */
            }
          }
        }
        /*
         else
         console.log("no currentDrop", d); */

        // console.log("dragged", dropTargetEnd, currentDropTarget, d);
      }

      // if (! dropTargetEnd)
      {
        let o = oa.o;
        // console.log("dragged o[d]", o[d], d3.event.x);
        o[d] = d3.event.x;
        // Now impose boundaries on the x-range you can drag.
        // The boundary values are in dragLimit, defined previously.
        if (o[d] < dragLimit.min) { o[d] = dragLimit.min; }
        else if (o[d] > dragLimit.max) { o[d] = dragLimit.max; }
      }
      //console.log(axisIDs + " " + o[d]);
      if (this === undefined)
      {
        console.log("dragged this undefined", d);
      }
      else
      {
        /* if (t === undefined)
         t = dragTransitionNew(); */
        draggedAxisRedraw(this, d, t);
      }
      if (stacks.changed & 0x01)
      {
        console.log("dragged", "stacks.changed 0x", stacks.changed.toString(16));
        stacks.changed ^= 0x01;
        axisStackChanged(undefined);
      }

      dragging--;
    } // dragged()

    /** Redraw the axis/axis which is being dragged.
     * Calls pathUpdate() which will mostly change the paths connected to the dragged axis;
     * but when dropIn/dropOut(), paths to other axes can be changed when stacking / adjacencies change.
     *
     * @param axisElt  node/DOM element corresponding of axis. this of dragged()
     * @param d axisName
     * @param t transition in which to make changes
     */
    function draggedAxisRedraw(axisElt, d, t)
    {
      let st0 = d3.select(axisElt);
      if (! st0.empty())
      {
        /* if (t === undefined)
         t = dragTransitionNew(); */
        // console.log("st0", st0._groups[0].length, st0._groups[0][0]);
        let st = st0; //.transition();  // t
        // st.ease(d3.easeQuadOut);
        // st.duration(dragTransitionTime);
        st.attr("transform", Stack.prototype.axisTransformO);
        // zoomed affects transform via path() : axisTransform.
        if (oa.drawOptions.continuousPathUpdate && (trace_path < 2))
          pathUpdate(t || st);
        //Do we need to keep the brushed region when we drag the axis? probably not.
        //The highlighted features together with the brushed regions will be removed once the dragging triggered.
        // st0.select(".brush").call(y[d].brush.move,null);
        //Remove all highlighted Features.
        oa.svgContainer.selectAll("circle").remove();
      }
    }

    /** Called when axisID has been dragged from one stack to another.
     * It is expected that the group element of the axis, g.axis-outer#<eltId(axisID)>,
     * needs to be moved from the source g.stack to destination.
     * @param axisID name/id of axis
     * @param t drag transition
     */
    function axisChangeGroupElt(axisID, t)
    {
      let aS_ = "g.axis-outer#" + eltId(axisID),
      aS = t.selectAll(aS_),
      gStack = aS._groups[0][0].parentNode;
      // let p = t.select(function() { return gStack; });
      // console.log("axisChangeGroupElt", axisID, t, aS_, aS, p);
      // compare with axis->stack
      let axis = oa.axes[axisID],
      stackID = axis.stack && axis.stack.stackID,
      /** destination Stack selection */
      dStack_ = "g.stack#" + stackEltId(axis.stack),
      dStackS = t.selectAll(dStack_),
      dStack = dStackS._groups[0][0], // equiv : .node()
      differentStack = gStack !== dStack;
      console.log("axisChangeGroupElt", axis, stackID, dStack_, dStackS, dStack, differentStack);

      // not currently used - g.stack layer may be discarded.
      if (false && differentStack)
      {
        var removedGAxis = aS.remove(),
        removedGAxisNode = removedGAxis.node();
        console.log("removedGAxis", removedGAxis, removedGAxisNode);
        let dStackN = dStackS.node();
        // tried .append, .appendChild(), not working yet.
        if (dStackN && dStackN.append)
          //  dStackN.append(removedGAxisNode);
          dStackN.append(function() { return removedGAxisNode;});
      }
    }

//- moved to utils/log-selection : fromSelectionArray(), logSelectionLevel(), logSelection()

//- paths
    function log_path_data(g)
    {
      let p3 = g.selectAll("g").selectAll("path");  // equiv : g.selectAll("g > path")
      console.log(p3._groups.length && p3._groups[0][0].__data__);
    }

    /** Update the paths connecting features present in adjacent stacks.
     * @param t undefined, or a d3 transition in which to perform the update.
     * @param flow  configures the data sources, processing, and output presentation
     */
    function pathUpdate_(t, flow)
    {
      let pathData = flow.pathData,
      unique_1_1_mapping = flow.direct ? false : (flow.unique ? true : 3),
      // pathDataInG = true,
      pathClass = flow.direct ? I : pathClassA;
      // "exported" to patham().
      pathDataIsLine = flow.direct;
      // console.log("pathUpdate");
      tracedAxisScale = {};  // re-enable trace, @see trace_scale_y
      let g = flow.g.selectAll("g");
      let gn;
      /* if (unique_1_1_mapping)
       {*/
      if (trace_path)
        console.log("pathUpdate() pathData", flow.name, pathData.length, g.size()); // , pathData
      if (trace_path > 1)
        for (let pi=0; pi < pathData.length; pi++)
          log_ffaa(pathData[pi]);
      g = g.data(pathData);
      if (trace_path)
        console.log("exit", g.exit().size(), "enter", g.enter().size());
      if (trace_path && pathData.length === 0)
      {
        console.log("pathData.length === 0");
      }
      g.exit().remove();
      function log_foreground_g(selector)
      {
        let gg = oa.foreground.selectAll(selector);
        console.log("gg", selector, gg._groups[0], gg.size());
        if (true)
        {
          let gg0 = gg._groups[0];
          for (let gi=0; (gi < gg0.length) && (gi < 10); gi++)
          {
            log_ffaa(gg0[gi].__data__);
            console.log(gg0[gi]);
          }
        }
      }
      gn = g.enter().append("g");
      // insert data into path elements (each line of the "map" is a path)
      let pa;
      if (flow.direct)
      {
        if (trace_path)
          console.log(flow.name, gn.size(), gn);
        // pa = gn.append("path");
        // log_path_data(flow.g);
        let p2 = flow.g.selectAll("g").selectAll("path").data(path);
        // log_path_data(flow.g);
        // pa = g.selectAll("path").data(path)
        pa = p2.enter().append("path");
        let p2x = p2.exit();
        if (! p2x.empty())
        {
          console.log("pathUpdate_", "p2x", p2x._groups[0]);
          p2x.remove();
        }

      }
      else
      {
        pa =
          gn.append("path");
        let gx = g.exit();
        if (! gx.empty())
        {
          console.log("pathUpdate_", "gx", gx._groups[0]);
          gx.remove();
        }
        if (! pathDataInG)
          g.selectAll("path").data(pathData);
      }
      if (trace_path > 1)
        log_foreground_g("g > g > path");
      (pathDataInG ? gn : pa)
      //.merge()
        .attr("class", pathClass);
      //}
      let
        path_ = unique_1_1_mapping ? (pathDataInG ? pathUg : pathU) : path,
      /** The data of g is feature name, data of path is SVG path string. */
      keyFn =function(d) { let featureName = featureNameOfPath(this); 
                           console.log("keyFn", d, this, featureName); 
                           return featureName; };
      /* The ffaa data of path's parent g is accessed from path attribute
       * functions (i.e. style(stroke), classed(reSelected), gKeyFn(), d, etc.);
       * alternately it could be stored in the path's datum and accessed
       * directly.  This would be needed if there were multiple path's within a
       * g elt.  There is incomplete draft of this (changing the data of path to
       * ffaa) in branch devel-path-data),
       *
       * Here the SVG line string is calculated by path_ from the parent g data,
       * and the attr d function is identity (I) to copy the path datum.
       */
      if (false)
      {
        let gd = /*g.selectAll("path")*/gn/*pa*/.data(path_/*, keyFn*/);
        let en = gd.enter();
        if (trace_stack > 1)
        {
          let ex = gd.exit();
          if (ex.size())
            console.log("gd.exit()", ex);
          if (en.size())
            console.log("gd.enter()", en);
        }
        gd.exit().remove();
      }
      if (trace_path && pathData.length > 0 &&  g.size() === 0)
      {
        console.log("pathUpdate", pathData.length, g.size(), gn.enter().size(), t);
      }
      let gp;
      if ((trace_path > 1) && (pathData.length != (gp = d3.selectAll(".foreground > g." + flow.name + " > g > path")).size()))
      {
        console.log("pathData.length", pathData.length, "!= gp.size()", gp.size());
      }

      // .merge() ...
      if (true)
      {
        /** attr d function has not changed, but the data has.
         * even where the datum is the same, the axes may have moved.
         * So update all paths.
         */
        let t1= (t === undefined) ? foreground.select(" g." + flow.name)  : flow.g.transition(t),
        p1 = t1.selectAll("g > path"); // pa
        p1.attr("d", pathDataIsLine ? I : path_);
        if (trace_path > 3)
          log_path_data(flow.g);
        setupMouseHover(pa);
      }
      else
      {
        if (t === undefined) {t = d3; }
        t.selectAll(".foreground > g." + flow.name + "> g > path").attr("d", function(d) { return d; });
        setupMouseHover(
          flow.g.selectAll("g > path")
        );
      }
      pathColourUpdate(pa, flow);
    }
    /** call pathUpdate(t) for each of the enabled flows. */
    function pathUpdate(t)
    {
      d3.keys(flows).forEach(function(flowName) {
        let flow = flows[flowName];
        if (flow.enabled)
          pathUpdate_(t, flow);
      });
    }
//- paths-classes
    /** Get the data corresponding to a path element, from its datum or its parent element's datum.
     * In the case of using aliases, the parent g's data is [f, f, axis, axis, ...] "ffaa".
     */
    function dataOfPath(path)
    {
      let pa = pathDataInG
        ? path.parentElement || path._parent /* EnterNode has _parent not parentElement */
        : path,
      da = pa.__data__;
      return da;
    }
    /** Get the featureName of a path element, from its corresponding data accessed via dataOfPath().
     */
    function featureNameOfPath(path)
    {
      let da = dataOfPath(path),
      featureName = featureNameOfData(da);
      return featureName;
    }
    /** If featureName has an alias group with a feature with an assigned class (colour) then return the classes.
     * @return undefined otherwise
     */
    function colouredAg(axisName, featureName)
    {
      let classSet,
      feature = oa.z[axisName][featureName], //  || oa.featureIndex[featureName],  // use featureIndex[] if featureName was ID, but instead have converted IDs -> names.
      aliasGroupName = feature.aliasGroupName;
      if (aliasGroupName)
      {
        classSet = aliasGroupClasses[aliasGroupName];
      }
      return classSet;
    }
    function classFromSet(classSet)
    {
      /** can use any element of set; later may cycle through them with slider. */
      let colourOrdinal = classSet.values().next().value;
      return colourOrdinal;
    }
    /** @param axisName could be chrName : feature name is looked up via axisName,
     * but intervals might be defined in terms of chrName; which is currently
     * the same thing, but potentially 1 chr could be presented by multiple axes.
     * see axisName2Chr();
     * @return name of interval, as per makeIntervalName()
     * Later maybe multiple results if intervals overlap.
     */
    function locationClasses(axisName, featureName)
    {
      let classes,
      f = oa.z[axisName][featureName],
      location = f.location,
      chrName = axisName2Chr(axisName),
      mapChrName = axisId2Name(axisName) + ":" + chrName,
      it = intervalTree[axisName];

      if (it)
        //Find all intervals containing query point
        it.queryPoint(location, function(interval) {
          /* later return Set or array of classes.  */
          classes = makeIntervalName(mapChrName, interval);
          if (trace_path_colour > 2)
            console.log("locationClasses", "axisName", axisName, "mapChrName", mapChrName, "featureName", featureName, ", scaffold/class", classes);
        });
      
      return classes;  
    }
    /** Access featureName/s from d or __data__ of parent g of path.
     * Currently only used when (use_path_colour_scale === 4), but aims to be more general.
     * Lookup featureScaffold to find class, or if (use_path_colour_scale === 4)
     * also look up colouredAg().  @see use_path_colour_scale

     * The scaffold of a feature was the first use; this has been generalised to a "class";
     * i.e. feature names are mapped (via colouredFeatures) to class names.
     * This function is used by stroke (todo) and class functions of path.
     * (based on a blend & update of those 2, mostly a copy of stroke).
     * @param pathElt <path> element which is to be coloured / classed
     * @param d datum of pathElt
     */
    function pathClasses(pathElt, d)
    {
      let classes;
      /** d is path SVG line text if pathDataIsLine */
      let da = dataOfPath(pathElt);
      /** similar to : (da.length === 4) or unique_1_1_mapping */
      let dataIsMmaa = typeof(da) === "object";
      let featureName = dataIsMmaa ? da[0] : da, // also @see featureNameOfPath(pathElt)
      colourOrdinal;
      if (use_path_colour_scale < 4)
      {
        colourOrdinal = featureName;
      }
      else if (use_path_colour_scale === 4)
      {
        colourOrdinal = featureScaffold[featureName];
        /* colour the path if either end has a class mapping defined.
         * if d[0] does not then check d[1].
         */
        if ((colourOrdinal === undefined) && dataIsMmaa
            && (da[0] != da[1]))
        {
          colourOrdinal = /*featureScaffold[da[0]] ||*/ featureScaffold[da[1]];
        }
        if (trace_path_colour > 2)
          console.log("featureName", featureName, ", scaffold/class", colourOrdinal);
      }
      else if (use_path_colour_scale === 5)
      {
        // currently, result of locationClasses() is a string identifying the interval,
        // and matching the domain value.
        if (dataIsMmaa)
        {
          classes = locationClasses(da[2].axisName, featureName)
            || locationClasses(da[3].axisName, da[1]);
        }
        else
        {
          let Axes = oa.featureAxisSets[featureName], axisName;
          // choose the first chromosome;  may be unique.
          // if not unique, could colour by the intervals on any of the Axes,
          // but want just the Axes which are points on this path.
          for (axisName of Axes) { break; }
          classes = locationClasses(axisName, featureName);
        }
      }
      if (classes !== undefined)
      {
      }
      else if (colourOrdinal)
        classes = colourOrdinal;
      else if (dataIsMmaa)
      {
        /* Like stroke function above, after direct lookup of path end
         * features in featureScaffold finds no class defined, lookup via
         * aliases of end features - transitive.
         */
        /* if ! dataIsMmaa then have featureName but no Axes; is result of a direct flow,
         * so colouring by AliasGroup may not be useful.
         */
        // collateStacks() / maInMaAG() could record in pathsUnique the alias group of the path.
        let [feature0, feature1, a0, a1] = da;
        let classSet = colouredAg(a0.axisName, feature0) || colouredAg(a1.axisName, feature1);
        classes = classSet;
      }
      return classes;
    }
    function pathColourUpdate(gd, flow)
    {
      if (trace_path_colour)
      {
        console.log
        ("pathColourUpdate", flow && flow.name, flow,
         use_path_colour_scale, path_colour_scale_domain_set, path_colour_scale.domain());
        if (gd && (trace_path_colour > 2))
          logSelection(gd);
      }
      let flowSelector = flow ? "." + flow.name : "";
      if (gd === undefined)
        gd = d3.selectAll(".foreground > g" + flowSelector + "> g").selectAll("path");

      if (use_path_colour_scale && path_colour_scale_domain_set)
        if (use_path_colour_scale >= 4)
          gd.style('stroke', function(d) {
            let colour;
            /** d is path SVG line text if pathDataIsLine */
            let da = dataOfPath(this);
            /** similar to : (da.length === 4) or unique_1_1_mapping */
            let dataIsMmaa = typeof(da) === "object";
            let featureName = dataIsMmaa ? da[0] : da, // also @see featureNameOfPath(this)
            colourOrdinal = featureName;
            if (use_path_colour_scale === 4)
            {
              colourOrdinal = featureScaffold[featureName];
              /* colour the path if either end has a class mapping defined.
               * if d[0] does not then check d[1].
               */
              if ((colourOrdinal === undefined) && dataIsMmaa
                  && (da[0] != da[1]))
              {
                colourOrdinal = featureScaffold[da[0]] || featureScaffold[da[1]];
              }
            }
            else if (use_path_colour_scale === 5)
            {
              let classSet = pathClasses(this, d);
              colourOrdinal = (classSet === undefined) ||
                (typeof classSet == "string")
                ? classSet : classFromSet(classSet);
            }
            // path_colour_scale(undefined) maps to pathColourDefault
            if ((colourOrdinal === undefined) && dataIsMmaa)
            {
              /* if ! dataIsMmaa then have featureName but no Axes; is result of a direct flow,
               * so colouring by AliasGroup may not be useful.
               */
              // collateStacks() / maInMaAG() could record in pathsUnique the alias group of the path.
              let [feature0, feature1, a0, a1] = da;
              let classSet = colouredAg(a0.axisName, feature0) || colouredAg(a1.axisName, feature1);
              if (classSet)
                colourOrdinal = classFromSet(classSet);
              if (false && colourOrdinal)
                console.log(featureName, da, "colourOrdinal", colourOrdinal);
            }
            if (colourOrdinal === undefined)
              colour = undefined;
            else
              colour = path_colour_scale(colourOrdinal);

            if (false && (colour !== pathColourDefault))  // change false to enable trace
              console.log("stroke", featureName, colourOrdinal, colour);
            return colour;
          });

      if (use_path_colour_scale === 3)
        gd.classed("reSelected", function(d, i, g) {
          /** d is path SVG line text */
          let da = dataOfPath(this);
          let dataIsMmaa = typeof(da) === "object";
          let featureName = dataIsMmaa ? da[0] : da;

          let pathColour = path_colour_scale(featureName);

          // console.log(featureName, pathColour, d, i, g);
          let isReSelected = pathColour !== pathColourDefault;
          return isReSelected;
        });

      if (use_path_colour_scale >= 4)
        gd.attr("class", function(d) {
          let scaffold, c,
          classes = pathClasses(this, d),
          simpleClass;
          if ((simpleClass = ((typeof(classes) != "object"))))
          {
            scaffold = classes;
          }
          else  // classes is a Set
          {
            let classSet = classes;
            scaffold = "";
            for (let cl of classSet)
            {
              scaffold += " " + cl;
            }
            // console.log("class", da, classSet, scaffold);
          }

          if (scaffold)
          {
            c = (simpleClass ? "" : "strong" + " ") + scaffold;
            if (trace_path_colour > 2)
              console.log("class", scaffold, c, d, this);
          }
          else if (false)
          {
            console.log("class", this, featureNameOfPath(this), featureScaffold, scaffold, c, d);
          }

          return c;
        });
    }

    function scaffoldLegendColourUpdate()
    {
      console.log("scaffoldLegendColourUpdate", use_path_colour_scale);
      if (use_path_colour_scale === 4)
      {
        let da = Array.from(scaffolds),
        ul = d3.select("div#scaffoldLegend > ul");
        // console.log(ul, scaffolds, da);
        let li_ = ul.selectAll("li")
          .data(da);
        // console.log(li_);
        let la = li_.enter().append("li");
        // console.log(la);
        let li = la.merge(li_);
        li.html(I);
        li.style("color", function(d) {
          // console.log("color", d);
          let scaffoldName = d,
          colourOrdinal = scaffoldName;
          let colour = path_colour_scale(colourOrdinal);

          if (false && (colour != pathColourDefault)) // change false to enable trace
          {
            console.log("color", scaffoldName, colour, d);
          }
          return colour;
        });
      }
    }

//- axis/stacks-drag
    function deleteAfterDrag() {
      let stacks = oa.stacks;
      if (trace_stack)
        console.log("deleteAfterDrag", stacks.toDeleteAfterDrag);

      if (stacks.toDeleteAfterDrag !== undefined)
      {
        stacks.toDeleteAfterDrag.delete();
        stacks.toDeleteAfterDrag = undefined;
      }
      Stack.verify();
      stacksAxesDomVerify(stacks, oa.svgContainer);
    }
    /** recalculate all stacks' Y position.
     * Used after drawing / window resize.
     */
    function stacksAdjustY()
    {
      oa.stacks.forEach(function (s) { s.calculatePositions(); });
    }
    /** recalculate stacks X position and show via transition
     * @param changedNum  true means the number of stacks has changed.
     * @param t undefined or transition to use for axisTransformO change
     * @see stacks.log() for description of stacks.changed
     */
    function stacksAdjust(changedNum, t)
    {
      if (changedNum)
        collateO();
      collateStacks();
      if (changedNum)
      {
        if (t === undefined)
          t = d3.transition().duration(dragTransitionTime);
        t.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
        if (trace_stack > 2)
        {
          let a=t.selectAll(".axis-outer");
          a.nodes().map(function(c) { console.log(c);});
          console.log('stacksAdjust', changedNum, a.nodes().length);
        }
        if (svgContainer)
          oa.stacks.forEach(function (s) { s.redrawAdjacencies(); });
      }
      // pathUpdate() uses flow.g, which is set after oa.foreground.
      if (oa.foreground && ysUpdated)
      {
        pathUpdate(t);
        countPathsWithData();
      }

      if (stacks.changed & 0x10)
      {
        console.log("stacksAdjust", "stacks.changed 0x", stacks.changed.toString(16));
        stacks.changed ^= 0x10;
        if (svgContainer === undefined)
          Ember.run.later(function () {
            axisStackChanged(t);
          });
        else
          axisStackChanged(t);
      }

      return t;
    }
    function dragended(/*d*/) {
      deleteAfterDrag();
      let stacks = oa.stacks;
      stacks.sortLocation();

      // in the case of dropOut(),
      // number of stacks has increased - need to recalc the domain, so that
      // x is defined for this axis.
      //
      // Order of axisIDs may have changed so need to redefine x and o.
      updateXScale();
      // if caching, recalc : collateAxisPositions();
      
      /* stacks.changed only needs to be set if sortLocation() has changed the
       * order, so for an optimisation : define stacks.inOrder() using reduce(),
       * true if stacks are in location order.
       */
      stacks.changed = 0x10;
      let t = stacksAdjust(true, undefined);
      // already done in xScale()
      // x.domain(axisIDs).range(axisXRange);
      // stacksAdjust() calls redrawAdjacencies().  Also :
      /* redrawAdjacencies() is called from .redraw(), and is mostly updated
       * during dragged(), but the stacks on either side of the origin of the
       * drag can be missed, so simply recalc all here.
       */

      d3.select(this).classed("active", false);
      let svgContainer = oa.svgContainer;
      svgContainer.classed("axisDrag", false);
      d3.event.subject.fx = null;
      Stack.currentDrag = undefined;
      /** This could be updated during a drag, whenever dropIn/Out(), but it is
       * not critical.  */
      vc.xDropOutDistance_update(oa);


      if (svgContainer.classed("dragTransition"))
      {
        console.log("dragended() dragTransition, end");
        dragTransition(false);
      }
      stacks.log();
    }
    

//- axis-brush-zoom
    /** flip the value of features between the endpoints
     * @param features is an array of feature names, created via (zoom) brush,
     * and input via text box
     */
    this.set('draw_flipRegion', function(features) {
      let brushedMap, zm,
      selectedAxes = oa.selectedAxes;
      if (selectedAxes.length === 0)
        console.log('draw_flipRegion', 'selectedAxes is empty', selectedAxes);
      else if ((brushedMap = selectedAxes[0]) === undefined)
        console.log('draw_flipRegion', 'selectedAxes[0] is undefined', selectedAxes);
      else if ((zm = oa.z[brushedMap]) === undefined)
        console.log('draw_flipRegion', 'z[', brushedMap, '] is undefined', selectedAxes, oa.z);
      else
      if (features.length)
      {
        /** the first and last features have the minimum and maximum position
         * values, except where flipRegion has already been applied. */
        let limits = [undefined, undefined];
        limits = features
          .reduce(function(limits_, fi) {
            // console.log("reduce", fi, limits_, zm[fi]);
            // feature aliases may be in the selection and yet not in the map
            let zmi = zm[fi];
            if (zmi)
            {
              let l = zmi.location;
              if (limits_[0] === undefined || limits_[0] > l)
                limits_[0] = l;
              if (limits_[1] === undefined || limits_[1] < l)
                limits_[1] = l;
            }
            // console.log(zmi, l, limits_);
            return limits_;
          }, limits);
        // console.log("limits", limits);

        let f0  = features[0], f1  = features[features.length-1],
        locationRange = limits,
        /** delta of the locationRange interval */
        rd = locationRange[1] - locationRange[0],
        invert = function (l)
        {
          let i = rd === 0 ? l : locationRange[1] + (locationRange[0] - l);
          // console.log("invert", l, i);
          return i;
        };
        console.log("draw_flipRegion", /*features, zm,*/ f0 , f1 , locationRange, rd);
        d3.keys(zm).forEach(function(feature) {
          if (! isOtherField[feature]) {
          let feature_ = zm[feature], fl = feature_.location;
          if (locationRange[0] <= fl && fl <= locationRange[1])
            feature_.location = invert(fl);
          }
        });
        pathUpdate(undefined);
      }
    });

//- paths-classes
    this.set('clearScaffoldColours', function() {
      console.log("clearScaffoldColours");
      featureScaffold = {}, scaffolds = new Set(), scaffoldFeatures = {};
      aliasGroupClasses = {};
      pathColourUpdate(undefined, undefined);
    });

//- axis-menu
    let apTitleSel = "g.axis-outer > text";
      function glyphIcon(className, id, glyphiconName, href) {
        return ''
          + '<span class="glyphicon ' + glyphiconName + '" aria-hidden=true></span>';
      }
    function iconButton(className, id, htmlIcon, glyphiconName, href)
    {
      /** selects glyphicon or html icon */
      let useGlyphIcon = false;
        return ''
        + '<button class="' + className + '" id="' + id + '" href="' + href + '">'
        + (useGlyphIcon ? glyphIcon(glyphiconName) : htmlIcon)
        + '</button>';
    }



    /** Setup hover menus over axis titles.
     * So far used just for Delete
     * @see based on similar configurejQueryTooltip()
     */
    function  configureAxisTitleMenu(axisName) {
      if (trace_gui)
      console.log("configureAxisTitleMenu", axisName, this, this.outerHTML);
        let node_ = this;
        Ember.$(node_)
        .popover({
            trigger : "hover", // manual", // "click focus",
          sticky: true,
          delay: {show: 200, hide: 1500},
          container: 'div#holder',
          placement : "auto bottom",
          // title : axisName,
          html: true,
          /*
           *	╳	9587	2573	 	BOX DRAWINGS LIGHT DIAGONAL CROSS
           *	⇅	8645	21C5	 	UPWARDS ARROW LEFTWARDS OF DOWNWARDS ARROW
           *	↷	8631	21B7	 	CLOCKWISE TOP SEMICIRCLE ARROW
           *	⇲	8690	21F2	 	SOUTH EAST ARROW TO CORNER
           */
          content : ""
            + iconButton("DeleteMap", "Delete_" + axisName, "&#x2573;" /*glyphicon-sound-7-1*/, "glyphicon-remove-sign", "#")
            + iconButton("FlipAxis", "Flip_" + axisName, "&#x21C5;" /*glyphicon-bell*/, "glyphicon-retweet", "#")
            + iconButton("PerpendicularAxis", "Perpendicular_" + axisName, "&#x21B7;" /*glyphicon-bell*/, "glyphicon-retweet", "#")
            + iconButton("ExtendMap", "Extend_" + axisName, "&#x21F2;" /*glyphicon-star*/, "glyphicon-arrow-right", "#")
        })
        // .popover('show');
      
        .on("shown.bs.popover", function(event) {
          if (trace_gui)
            console.log("shown.bs.popover", event, event.target);
          // button is not found when show.bs.popover, but is when shown.bs.popover.
          // Could select via id from <text> attr aria-describedby=​"popover800256".
          let deleteButtonS = d3.select("button.DeleteMap");
          if (trace_gui)
            console.log(deleteButtonS.empty(), deleteButtonS.node());
          deleteButtonS
            .on('click', function (buttonElt /*, i, g*/) {
              console.log("delete", axisName, this);
              let axis = oa.axes[axisName], stack = axis && axis.stack;
              // axes[axisName] is deleted by removeStacked1() 
              let stackID = Stack.removeStacked(axisName);
              deleteAxisfromAxisIDs(axisName);
              let sBlock = oa.stacks.blocks[axisName];
              console.log('sBlock.axis', sBlock.axis);
              sBlock.axis = undefined;
              removeAxisMaybeStack(axisName, stackID, stack);
              me.send('mapsToViewDelete', axisName);
              // filter axisName out of selectedFeatures and selectedAxes
              selectedFeatures_removeAxis(axisName);
              sendUpdatedSelectedFeatures();
            });
          let flipButtonS = d3.select("button.FlipAxis");
          flipButtonS
            .on('click', function (buttonElt /*, i, g*/) {
              console.log("flip", axisName, this);
              let axis = oa.axes[axisName], ya = oa.y[axisName], ysa=oa.ys[axisName],
              domain = maybeFlip(ya.domain(), true);
              axis.flipped = ! axis.flipped;
              ya.domain(domain);
              ysa.domain(domain);

              let b = ya.brush;
              b.extent(maybeFlipExtent(b.extent()(), true));
              let t = oa.svgContainer.transition().duration(750);
              axisScaleChanged(axisName, t, true);
            });
          let perpendicularButtonS = d3.select("button.PerpendicularAxis");
          perpendicularButtonS
            .on('click', function (buttonElt /*, i, g*/) {
              console.log("perpendicular", axisName, this);
              let axis = oa.axes[axisName];
              axis.perpendicular = ! axis.perpendicular;

              oa.showResize(true, true);
            });

          let extendButtonS = d3.select("button.ExtendMap");
          if (trace_gui)
            console.log(extendButtonS.empty(), extendButtonS.node());
          extendButtonS
            .on('click', function (buttonElt /*, i, g*/) {
              console.log("extend", axisName, this);
              let axis = oa.axes[axisName], stack = axis && axis.stack;
              // toggle axis.extended, which is initially undefined.
              axis.extended = ! axis.extended;
              axisShowExtend(axis, axisName, undefined);
            });

        });
    }

      /** Render the affect of resize on the drawing.
       * @param widthChanged   true if width changed
       * @param heightChanged   true if height changed
       * @param useTransition  undefined (default true), or false for no transition
       */
    function showResize(widthChanged, heightChanged, useTransition)
    {
        console.log('showResize', widthChanged, heightChanged, useTransition);
        updateXScale();
        collateO();
        let 
          duration = useTransition || (useTransition === undefined) ? 750 : 0,
        t = oa.svgContainer.transition().duration(duration);
        let graphDim = oa.vc.graphDim;
        oa.svgRoot
        .attr("viewBox", oa.vc.viewBox.bind(oa.vc))
          .attr('height', graphDim.h /*"auto"*/);

      // for stacked axes, window height change affects the transform.
        if (widthChanged || heightChanged)
        {
        t.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
          // also xDropOutDistance_update (),  update DropTarget().size
        }

        if (heightChanged)
        {
          stacksAdjustY();
          oa.stacks.axisIDs().forEach(function(axisName) {
            axisScaleChanged(axisName, t, false);
          });
          // let traceCount = 1;
          svgContainer.selectAll('g.axis-all > g.brush')
            .each(function(d) {
              /* if (traceCount-->0) console.log(this, 'brush extent', oa.y[d].brush.extent()()); */
              d3.select(this).call(oa.y[d].brush); });
          pathUpdate(t /*st*/);

          DropTarget.prototype.showResize();
        }
        Ember.run.later( function () { showSynteny(syntenyBlocks, undefined); });
      };

//- brush-menu
    /** The Zoom & Reset buttons (g.btn) can be hidden by clicking the 'Publish
     * Mode' checkbox.  This provides a clear view of the visualisation
     * uncluttered by buttons and other GUI mechanisms
     */
    function setupToggle(checkboxId, onToggle)
    {
      let 
      checkbox = Ember.$("#" + checkboxId);
      checkbox.on('click', function (event) {
        let checked = checkbox[0].checked;
        console.log(checkboxId, checked, event.originalEvent);
        onToggle(checked);
      });
    }
//- draw-controls
    function setupTogglePathUpdate()
    {
      /* initial value of continuousPathUpdate is true, so .hbs has : checked="checked" */
      setupToggle
      ("checkbox-togglePathUpdate",
      function (checked) {
        oa.drawOptions.continuousPathUpdate = checked;
      }
      );
    }
    function setupToggleModePublish()
    {
      setupToggle
      ("checkbox-toggleModePublish",
      function (checked) {
        let svgContainer = oa.svgContainer;
        console.log(svgContainer._groups[0][0]);
        svgContainer.classed("publishMode", checked);
      }
      );
    }
    function setupToggleShowPathHover()
    {
      /* initial value of showPathHover is false */
      setupToggle
      ("checkbox-toggleModePathHover",
      function (checked) {
        oa.drawOptions.showPathHover = checked;
      }
      );
    }
    function setupToggleShowAll()
    {
      /* initial value of showAll is true, so .hbs has : checked="checked" */
      setupToggle
      ("checkbox-toggleShowAll",
      function (checked) {
        oa.drawOptions.showAll = checked;
        pathUpdate(undefined);
      }
      );
    }
    function setupToggleShowSelectedFeatures()
    {
      /* initial value of showSelectedFeatures is true, so .hbs has : checked="checked" */
      setupToggle
      ("checkbox-toggleShowSelectedFeatures",
      function (checked) {
        oa.drawOptions.showSelectedFeatures = checked;
        pathUpdate(undefined);
      }
      );
    }
    /** The stroke -opacity and -width can be adjusted using these sliders.
     * In the first instance this is for the .manyPaths rule, but
     * it could be used to factor other rules (.faded, .strong), or they may have separate controls.
     * @param varName string : name of css variable to set the input value into,
     * or otherwise a function to call with the input value.
     * (this will be split into 2 functions with different signatures, the varName version calling the function version)
     * @param factor  scale the input (integer) value down by factor.
     * (perhaps change this to # decimal-digits, and display a value with decimal places)
     */
    function setupInputRange(inputId, varName, factor)
    {
      let input = Ember.$("#" + inputId);
      input.on('input', function (event) {
        let value = input[0].value / factor;
        console.log(inputId, value, event.originalEvent, oa.svgRoot._groups[0][0]);
        if (typeof varName == "string")
          setCssVariable(varName, value);
        else
          Ember.run.later(function () { varName(value); });
      });
    }
    function setupPathOpacity()
    {
      setupInputRange("range-pathOpacity", "--path-stroke-opacity", 100);
    }
    function setupPathWidth()
    {
      setupInputRange("range-pathWidth", "--path-stroke-width", 100);
    }
    function updateSbSizeThresh(value) {
      /** goal : aim is ~50 steps from 0 to 1000, with an initial/default value of 20.
       * base : x
       * x^50 = 1000 => 50 log(x) = log(1000) => x = e ^ log(1000) / 50
       * x = Math.pow(2.718, Math.log(1000) / 50) = 1.1481371748750222
       *	initial/default value of slider : y
       * x^y = 20 => y log(x) = log(20) => y = Math.log(20) / Math.log(1.148137) = 21.6861056
       * round to 22
       * so : in .hbs : id="range-sbSizeThreshold" :  min="0" max="50" value="22"
       *  min value is 0, so -1 to get 0. */
      oa.sbSizeThreshold=Math.pow(1.148137, value) - 1;
      Ember.run.later( function () { showSynteny(syntenyBlocks, undefined); });
    }
    function setupSbSizeThresh()
    {
      setupInputRange("range-sbSizeThreshold", updateSbSizeThresh, 1);
    }
    function setupVariousControls()
    {
      setupToggleShowPathHover();
      setupTogglePathUpdate();
      setupToggleShowAll();
      setupToggleShowSelectedFeatures();
      setupPathOpacity();
      setupPathWidth();
      setupSbSizeThresh();

      flows_showControls(flowButtonsSel);
      configurejQueryTooltip(oa, flowButtonsSel);
      setupToggleModePublish();
    }

//- flows-controls
    function flows_showControls (parentSelector)
    {
      let parent = d3.select(parentSelector);
      let flowNames = d3.keys(flows);
      /** button to toggle flow visibilty. */
      let b = parent.selectAll("div.flowButton")
        .data(flowNames)
        .enter().append("div");
      b
        .attr("class",  function (flowName) { return flowName;})
        .classed("flowButton", true)
        .classed("selected", function (flowName) { let flow = flows[flowName]; return flow.visible;})
        .on('click', function (flowName /*, i, g*/) {
          let event = d3.event;
          console.log(flowName, event);
          // sharing click with Export menu
          if (event.shiftKey)
            return;
          // toggle visibilty
          let flow = flows[flowName];
          console.log('flow click', flow);
          flow.visible = ! flow.visible;
          let b1=d3.select(this);
          b1.classed("selected", flow.visible);
          updateSelections();
          flow.g.classed("hidden", ! flow.visible);
        })
      /* To get the hover text, it is sufficient to add attr title.
       * jQuery doc (https://jqueryui.com/tooltip/) indicates .tooltip() need
       * only be called once per document, perhaps that is already done by
       * d3 / jQuery / bootstrap.
       */
        .attr("title", I)
        .attr("data-id", function (flowName) {
          return "Export:" + flowName;
        })
      ;

    };
    if (newRender)
    {
    setupVariousControls();
    }

//- draw-map
    /** After chromosome is added, draw() will update elements, so
     * this function is used to update d3 selections :
     * svgRoot, svgContainer, foreground, flows[*].g
     */
    function updateSelections() {
      let svgRoot = oa.svgRoot, svgContainer = oa.svgContainer,
      foreground = oa.foreground;
      console.log(
        "svgRoot (._groups[0][0])", svgRoot._groups[0][0],
        ", svgContainer", svgContainer._groups[0][0],
        ", foreground", foreground._groups[0][0]);
      svgRoot = d3.select('#holder > svg');
      svgContainer = svgRoot.select('g');
      foreground = svgContainer.select('g.foreground');
      console.log(
        "svgRoot (._groups[0][0])", svgRoot._groups[0][0],
        ", svgContainer", svgContainer._groups[0][0],
        ", foreground", foreground._groups[0][0]);
      d3.keys(flows).forEach(function (flowName) {
        let flow = flows[flowName];
        console.log(flowName, " flow.g", flow.g._groups[0][0]);
        flow.g = oa.foreground.select("g." + flow.name);
        console.log(flowName, " flow.g", flow.g._groups[0][0]);
      });

    };

//- paths-classes, should be getUsePathColour() ?
    function getUsePatchColour()
    {
      let inputParent = '#choose_path_colour_scale',
      inputs = Ember.$(inputParent + ' input'), val;
      for (let ii = 0;
           (ii < inputs.length) && (val === undefined);
           ii++)
      {
        if (inputs[ii].checked)
        {
          val = inputs[ii].getAttribute("data-value"); // .value;
          val = parseInt(val);
        }
      }
      console.log(inputParent + " value", val);
      return val;
    }

//- flows-controls
    Flow.prototype.ExportDataToDiv = function (eltSel)
    {
      let elts = Ember.$(eltSel), elt = elts[0];
      // or for text : elt.append()
      elt.innerHTML =
        "<div><h5>" + this.name + "</h5> : " + this.pathData.length + "</div>\n";
      this.pathData.forEach(function (ffaa) {
        let s = "<div>" + mmaa2text(ffaa) + "</div>\n";
        elt.insertAdjacentHTML('beforeend', s);
      });
    };


  },   // draw()


  didInsertElement() {
    // eltWidthResizable('.resizable');

    // initial test data for axis-tracks - will discard this.
    let oa = this.get('oa');
    oa.tracks  = [{start: 10, end : 20, description : "track One"}];
    this.set('toolTipHovered', false);
    Ember.run.later(function() {
      Ember.$('.make-ui-draggable').draggable(); });
  },

  didRender() {
    // Called on re-render (eg: add another axis) so should call
    // draw each time.
    //
    let me = this;
    let data = this.get('data');
      me.draw(data, 'didRender');

    highlightFeature_drawFromParams(this);
  },

    resize : function() {
    console.log("resize");
        /** when called via .observes(), 'this' is draw-map object.  When called
         * via Ember.run.debounce(oa, me.resize, ), 'this' is oa.
         */
        let layoutChanged = (arguments.length === 2),
            oa =  layoutChanged ? this.oa : this;
    // logWindowDimensions('', oa.vc.w);  // defined in utils/domElements.js
    function resizeDrawing() { 
      oa.vc.calc(oa);
      let
        widthChanged = oa.vc.viewPort.w != oa.vc.viewPortPrev.w,
      heightChanged = oa.vc.viewPort.h != oa.vc.viewPortPrev.h;

      // rerender each individual element with the new width+height of the parent node
      // need to recalc viewPort{} and all the sizes, (from document.documentElement.clientWidth,Height)
      // .attr('width', newWidth)
      /* Called from .resizable : .on(drag) .. resizeThis() , the browser has
       * already resized the <svg>, so a transition looks like 1 step back and 2
       * steps forward, hence pass transition=false to showResize().
      */
      oa.showResize(widthChanged, heightChanged, layoutChanged);
    }
        console.log("oa.vc", oa.vc, arguments);
        if (oa.vc)
        {
            if (! layoutChanged)
                // Currently debounce-d in resizeThis(), so call directly here.
                resizeDrawing();
            else
            {
                console.log(arguments[1], arguments[0]);
                Ember.run.debounce(resizeDrawing, 300);  // 0.3sec
            }
        }


  }
        .observes('layout.left.visible', 'layout.right.visible')

});

