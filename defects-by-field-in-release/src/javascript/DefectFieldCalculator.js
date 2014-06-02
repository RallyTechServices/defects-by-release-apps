Ext.define("TechnicalServices.burndown.DefectFieldCalculator", {
    extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

    config: {
        fieldName: 'State',
        validFieldValues: ['Open','Closed'],
        emptyValueString: 'No Value',
        releaseObjectIDs: [] /* leave empty to do ANY value */
    },
    
    getDerivedFieldsOnInput: function () {
        var releases = this.config.releaseObjectIDs;
        var field_name = this.config.fieldName;
        var empty_value = this.config.emptyValueString;
        /*
         * What is more or less going on here:  After the overall snapshots
         * have been parsed by luminize, we get a subset of snapshots that 
         * represent the items as they are in each time box.  We can now
         * add fields that can represent collated information about each item
         */
        return [
            {
                "as": "DisplayFieldValue",
                "f": function (snapshot) {
                    /* for situations where there is no value, want to make it "no value" */
                    var value = snapshot[field_name];
                    var release = snapshot.Release;
                    
                    if (!value) {
                        value = empty_value;
                    }
                    if ( releases.length !== 0 && Ext.Array.indexOf(releases,release) == -1) {
                        return -1;
                    }
                    return value;
                }
            },
            {
                "as": "InRelease",
                "f": function (snapshot) {
                    var release = snapshot.Release;
                    
                    if ( releases.length === 0 || Ext.Array.indexOf(releases,release) > -1) {
                        return true;
                    }
                    return false;
                }
            }
        ];
    },

    getMetrics: function () {
        var metric_array = [];
        var field_values = this.config.validFieldValues;
        var empty_value = this.config.emptyValueString;
        if ( Ext.Array.indexOf(field_values,empty_value) == -1 ){
            field_values.push(empty_value);
        }
        var field_name = this.config.fieldName;

        Ext.Array.each(field_values,function(value){
            metric_array.push({
                "filterField": "DisplayFieldValue",
                "as": value,
                "f": "filteredCount",
                "filterValues": [value],
                "display": "column"
            });
        });
        
        return metric_array;
    },

    getSummaryMetricsConfig: function () {
        return [];
    },

    getDerivedFieldsAfterSummary: function () {
        return  [];
    },

    runCalculation: function (snapshots) {
        var chartData = this.callParent(arguments);
        var today = Rally.util.DateTime.add(new Date(),"day",1); //include today
        Ext.Array.each(chartData.series,function(series,idx){
            this._removeFutureSeries(chartData, idx, this._indexOfDate(chartData,today,true));
        },this);

        this._formatCategories(chartData);
        return chartData;
    },
    
    _formatCategories:function(chartData){
        var categories = [];
        Ext.Array.each(chartData.categories,function(category) {
            var date_array = category.split('-');
            categories.push(date_array[1] + "/" + date_array[2]);
        });
        
        chartData.categories = categories;
        
    },

    _indexOfDate: function(chartData, date, find_next_day_if_missing ) {
         var dateStr = Ext.Date.format(date, 'Y-m-d');
         var categories = chartData.categories;
         
         var idx = Ext.Array.indexOf(categories,dateStr);
         if ( idx > -1 ) {
            return idx;
         }
         if ( find_next_day_if_missing ) {
            var test_idx = categories.length - 1;
            while ( test_idx > -1 ) {
                if (categories[test_idx] > dateStr ) {
                    break;
                }
                test_idx = test_idx - 1;
            }
            return test_idx;
         }
         return -1;
    },
    
    _removeFutureSeries: function (chartData, seriesIndex, cutOffIndex ) { 
        
        if(chartData.series[seriesIndex].data.length > cutOffIndex && cutOffIndex > -1) {
            var idx = cutOffIndex;
            
            while(idx < chartData.series[seriesIndex].data.length) {
                chartData.series[seriesIndex].data[idx] = null;
                idx++;
            }
        }
    }
});