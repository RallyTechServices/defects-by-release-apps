Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 5, padding: 5 },
    items: [
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'display_box'},
        {xtype:'tsinfolink'}
    ],
    launch: function() {
        this.down('#selector_box').add({
            xtype:'rallyreleasecombobox',
            fieldLabel: 'Release:',
            labelWidth: 45,
            listeners: {
                scope: this,
                change: function(box) {
                    this._getData(box.getRecord().get('Name'));
                }
            }
        });
    },
    _getData: function(release_name) {
        this._getReleases(release_name).then({
            scope: this,
            success: function(releases){
                this._makeChart(this.down('#display_box'),releases);
            }, 
            failure: function(message) {
                alert("Problem Loading Releases " + message);
            }
        });
    },
    _getReleases: function(release_name) {
        var deferred = Ext.create('Deft.Deferred');
        Ext.create('Rally.data.wsapi.Store',{
            model:'Release',
            autoLoad:true,
            fetch:['ObjectID','ReleaseDate','ReleaseStartDate'],
            filters: [{property:'Name',value:release_name}],
            listeners:{
                load: function(store,records){
                    deferred.resolve(records);
                }
            }
        });
        return deferred;
    },
    _getUserTimeZone: function() {
        var tz = this.getContext().getUser().UserProfile.TimeZone;
        if (!tz) {
            tz = this.getContext().getWorkspace().WorkspaceConfiguration.TimeZone;
        }
        return tz;
    },
    _makeChart: function(display_box,releases) {
        this.logger.log("_makeChart",releases);
        
        var release_oids = [];
        Ext.Array.each(releases,function(release){
            release_oids.push(release.get('ObjectID'));
        });
        
        var startDate = Rally.util.DateTime.add(new Date,'month',-3);
        var endDate = new Date();
        if ( releases.length ) {
            startDate = releases[0].get('ReleaseStartDate');
            endDate = releases[0].get('ReleaseDate');
        }
        
        display_box.removeAll();
        display_box.add({
            xtype:'rallychart',
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: {
                find: {
                    _TypeHierarchy: 'Defect',
                    _ProjectHierarchy: this.getContext().getProject().ObjectID
                },
                fetch: ['PlanEstimate','State','Release'],
                hydrate: ['State']
            },
            calculatorType: 'TechnicalServices.burndown.DefectTrendCalculator',
            calculatorConfig: {
                releaseObjectIDs:release_oids,
                timeZone: this._getUserTimeZone(),
                startDate: startDate,
                endDate: endDate,
                granularity: 'day',
                workDays: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
            },
            sort: {
                "_ValidFrom": 1
            },
            chartColors: ['#000000','#CC3366','#66FF66'],
            chartConfig: {
                chart: {
                    zoomType: "xy"
                },
                title: { text: 'Defect Trend' },
                xAxis: {
                    tickmarkPlacement: 'on',
                    tickInterval: 14,
                    title: { text: 'Days' },
                    labels: { rotation: -65, align: 'right' }
                },
                yAxis: [{
                    min: 0,
                    title:{text:'Count'}
                }],
                tooltip: {
                    shared: true
                }
            }
        });
    }
});
