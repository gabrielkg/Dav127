import Component from '@ember/component';

/* global d3 */

export default Component.extend({

  actions: {

    selectionChanged: function(selA) {
      console.log("selectionChanged in components/axis-table", selA);
      for (let i=0; i<selA.length; i++)
        console.log(selA[i].feature, selA[i].position);
    },
  },

});
