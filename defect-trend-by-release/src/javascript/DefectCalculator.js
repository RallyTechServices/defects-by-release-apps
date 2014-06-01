Ext.define("TechnicalServices.burndown.DefectTrendCalculator", {
    extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

    config: {
        closedStateNames: 'Closed',
        releaseObjectIDs: [] /* leave empty to do ANY value */
    },
    
    getDerivedFieldsOnInput: function () {
        var completedStates = this.config.closedStateNames
        var releases = this.config.releaseObjectIDs;
        /*
         * What is more or less going on here:  After the overall snapshots
         * have been parsed by luminize, we get a subset of snapshots that 
         * represent the items as they are in each time box.  We can now
         * add fields that can represent collated information about each item --
         * for example, we'll determine whether each item is an active defect:
         * is it: a) not closed and b) in one of the given releases?
         * 
         * Then later we can apply functions to say all the ones that are true
         * and all the ones that are false
         */
        return [
            {
                "as": "ActiveDefectInRelease",
                "f": function (snapshot) {
                    var state = snapshot.State;
                    var release = snapshot.Release;
                    
                    if (Ext.Array.indexOf(completedStates,state) == -1) {
                        if ( releases.length === 0 || Ext.Array.indexOf(releases,release) > -1) {
                            return true;
                        }
                    }
                    return false;
                }
            },
            {
                "as": "ClosedDefectInRelease",
                "f": function (snapshot) {
                    var state = snapshot.State;
                    var release = snapshot.Release;
                    
                    if (Ext.Array.indexOf(completedStates,state) > -1) {
                        if ( releases.length === 0 || Ext.Array.indexOf(releases,release) > -1) {
                            return true;
                        }
                    }
                    return false;
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
        return [
            {
                "filterField": "ActiveDefectInRelease",
                "as": "Daily Active",
                "f": "filteredCount",
                "filterValues": [true]
            },
            {
                "filterField": "ClosedDefectInRelease",
                "as": "Cumulative Closed",
                "f": "filteredCount",
                "filterValues": [true]
            },
            {
                "filterField": "InRelease",
                'as':'Cumulative Created',
                'f':'filteredCount',
                'filterValues':[true]
            }
        ];
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
        console.log(chartData);
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