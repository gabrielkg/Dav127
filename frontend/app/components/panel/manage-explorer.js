import Ember from 'ember';
import { inject as service } from '@ember/service';

import ManageBase from './manage-base'

export default ManageBase.extend({
  apiEndpoints: service('api-endpoints'),

  init() {
    this._super();
    let store = this.get('store');

    let me = this;
    this.get('apiEndpoints').on('receivedDatasets', function (datasets) { console.log('receivedDatasets', datasets); me.send('receivedDatasets', datasets); });
    let view = me.get('view');
    let filter = {'include': 'blocks'};
    if (view == 'matrixview') {
      filter['where'] = {'type': 'observational'};
    }
    if (false)
    store.query('dataset', {filter: filter}).then(function(datasets) {
      me.set('datasets', datasets.toArray());
    })
  },
  datasetType: null,

  filterOptions: {
    'all': {'formal': 'All', 'icon': 'plus'},
    'private': {'formal': 'Private', 'icon': 'lock'},
    'owner': {'formal': 'Mine', 'icon': 'user'}
  },
  filter: 'all',
  layout: {
  },

  /** Return a list of datasets, with their included blocks, for the currently-selected
   * API endpoint tab
   */
  datasetsBlocks : Ember.computed('datasetsBlocksRefresh', 'endpointTabSelected', 'primaryDatasets', function() {
    /** e.g. "http___localhost_5000"  */
    let
      name = this.get('endpointTabSelected'),
    endpointSo = name &&
      this.get('apiEndpoints').lookupEndpoint(name),
    datasetsBlocks = endpointSo && endpointSo.get("datasetsBlocks");
    if (datasetsBlocks)
    {
      console.log('datasetsBlocks', endpointSo, datasetsBlocks);
    }
    let isPrimary = endpointSo && (this.get('apiEndpoints').get('primaryEndpoint') === endpointSo);
    if (! name || (! datasetsBlocks && isPrimary))
    {
      /* this is using the model datasets list for the primary API.
       * Perhaps instead will change mapview to use apiEndpoints service.
       */
      datasetsBlocks = this.get('primaryDatasets');
      console.log('datasetsBlocks()  using primaryDatasets', datasetsBlocks);
    }

    return datasetsBlocks;
  }),

  datasetsBlocksRefresh : 0,
  // datasets: [],

  endpoints : Ember.computed.alias('apiEndpoints.endpoints'),

  data: Ember.computed('filteredData', function() {
    let
    filteredData = this.get('filteredData'),
    combined = filteredData;
    console.log('data', filteredData);
    return combined;
  }),
  filteredData: Ember.computed('datasetsBlocks', 'primaryDatasets', 'filter', function() {
    let availableMaps = this.get('datasetsBlocks');
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    // let filtered = availableMaps //all
    if (filter == 'private') {
      let maps = availableMaps.filterBy('public', false)
      return maps
    } else if (filter == 'owner') {
      return availableMaps.filterBy('owner', true)
    } else {
      return availableMaps;
    }
  }),
  dataEmpty: Ember.computed('data', function() {
    let availableMaps = this.get('data')
    if (availableMaps && availableMaps.length > 0) { return false; }
    else { return true; }
  }),
  actions: {
    endpointTabSelected(tabId, apiEndpointName, apiEndpoint) {
      console.log('endpointTabSelected', tabId, apiEndpointName, apiEndpoint);
      this.set('endpointTabSelected', apiEndpointName);
    },
    receivedDatasets(datasetsHandle, blockValues) {
      console.log('receivedDatasets', datasetsHandle, blockValues);
      this.incrementProperty('datasetsBlocksRefresh');
    },
    refreshAvailable() {
      let me = this;
      let view = me.get('view');
      let filter = {'include': 'blocks'};
      if (view == 'matrixview') {
        filter['where'] = {'type': 'observational'};
      }
      console.log('refreshAvailable(), -	trigger service to query datasets');
      if (false)
      this.get('store').query('dataset', {filter: filter}).then(function(datasets) {
        me.set('datasets', datasets.toArray());
      });
    },
    deleteBlock(chr) {
      this.sendAction('deleteBlock', chr.id);
    },
    changeFilter: function(f) {
      this.set('filter', f)
    },
    onDelete(id) {
      
    },
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    },
    /** invoked from hbs via {{compute (action "endpointTabId" apiEndpoint ) }}
     * @return string suitable for naming a html tab, based on endpoint name.
     */
    endpointTabId(apiEndpoint) {
      let id = apiEndpoint.get('tabId');
      console.log('endpointTabId', id, apiEndpoint);
      return id;
    },
    /** Trim the leading http:// or https:// off the given URL.
     * Similar : @see ApiEndpoint.prototype.tabId
     */
    sansProtocol(url) {
      return url && url.replace(/^https?:\/\//, '');
    }
  }
});
