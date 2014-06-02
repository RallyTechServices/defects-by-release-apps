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
        if (typeof(this.getAppId()) == 'undefined' ) {
            // not inside Rally
            this._showExternalSettingsDialog(this.getSettingsFields());
        } else {
            this._addSelector();
        }
        
    },
    _addSelector: function() {
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
        var field_to_break_down = this.getSetting('metric_field');
        var display_box = this.down('#display_box');
        display_box.removeAll();
        
        if ( !field_to_break_down ) {
            display_box.add({xtype:'container',html:'You must set a field to calculate on by using "Edit App Settings" on the gear menu.'});
        } else {
            Deft.Promise.all([this._getReleases(release_name),this._getValidValues(field_to_break_down)]).then({
                scope: this,
                success: function(results){
                    var releases = results[0];
                    var allowed_values = results[1];
                    this._makeChart(display_box,releases,allowed_values);
                }, 
                failure: function(message) {
                    alert("Problem Loading Releases " + message);
                }
            });
        }
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
    _getValidValues: function(field_name) {
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.ModelFactory.getModel({
            type: 'Defect',
            success: function(model) {
                model.getField(field_name).getAllowedValueStore().load({
                    callback: function(records, operation, success) {
                        var allowed_values = [];
                        
                        Ext.Array.each(records, function(allowedValue) {
                            //each record is an instance of the AllowedAttributeValue model 
                            allowed_values.push(allowedValue.get('StringValue'));
                        });
                        deferred.resolve(allowed_values);
                    }
                });
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
    _makeChart: function(display_box,releases,allowed_values) {
        this.logger.log("_makeChart",releases,allowed_values);
        var field_to_break_down = this.getSetting('metric_field');

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
            calculatorType: 'TechnicalServices.burndown.DefectFieldCalculator',
            calculatorConfig: {
                releaseObjectIDs:release_oids,
                fieldName: field_to_break_down,
                validFieldValues: allowed_values,
                timeZone: this._getUserTimeZone(),
                startDate: startDate,
                endDate: endDate,
                granularity: 'day',
                workDays: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
            },
            sort: {
                "_ValidFrom": 1
            },
            /* chartColors: ['#000000','#CC3366','#66FF66'], */
            chartConfig: {
                chart: {
                    zoomType: "xy"
                },
                title: { text: 'Defect Counts by ' + field_to_break_down },
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
                },
                plotOptions: {
                    column: {
                        stacking: 'normal'
                    }
                }
            }
        });
    },
    getSettingsFields: function() {
        var _chooseOnlyDropDownFields = function(field){
            var should_show_field = false;
            var forbidden_fields = ['FormattedID','ObjectID','DragAndDropRank','Name'];
            if ( field.hidden ) {
                should_show_field = false;
            }
            if ( field.attributeDefinition ) {
                var type = field.attributeDefinition.AttributeType;
                if ( type == "RATING" ) {
                    should_show_field = true;
                }

                if ( Ext.Array.indexOf(forbidden_fields,field.name) > -1 ) {
                    should_show_field = false;
                }
            } else {
                should_show_field = false;
            }
            return should_show_field;
        };
        
        return [
            {
                name: 'metric_field',
                xtype: 'rallyfieldcombobox',
                model: 'Defect',
                fieldLabel: 'Break Down by Field:',
                _isNotHidden: _chooseOnlyDropDownFields,
                width: 300,
                labelWidth: 200
            }
        ];
    },
    // ONLY FOR RUNNING EXTERNALLY
    _showExternalSettingsDialog: function(fields){
        var me = this;
        if ( this.settings_dialog ) { this.settings_dialog.destroy(); }
        this.settings_dialog = Ext.create('Rally.ui.dialog.Dialog', {
             autoShow: false,
             draggable: true,
             width: 400,
             title: 'Settings',
             buttons: [{ 
                text: 'OK',
                handler: function(cmp){
                    var settings = {};
                    Ext.Array.each(fields,function(field){
                        settings[field.name] = cmp.up('rallydialog').down('[name="' + field.name + '"]').getValue();
                    });
                    me.settings = settings;
                    cmp.up('rallydialog').destroy();
                    me._addSelector();
                }
            }],
             items: [
                {xtype:'container',html: "&nbsp;", padding: 5, margin: 5},
                {xtype:'container',itemId:'field_box', padding: 5, margin: 5}]
         });
         Ext.Array.each(fields,function(field){
            me.settings_dialog.down('#field_box').add(field);
         });
         this.settings_dialog.show();
    },
    resizeIframe: function() {
        var iframeContentHeight = 800;    
        var container = window.frameElement.parentElement;
        if (container != parent.document.body) {
            container.style.height = iframeContentHeight + 'px';
        }
        window.frameElement.style.height = iframeContentHeight + 'px';
        return;
    }
});
