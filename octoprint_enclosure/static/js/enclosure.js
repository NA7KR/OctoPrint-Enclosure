/*------------------------------------------------------------------------------------------------------------------------
 * enclosure.js for OctoPrint_Enclosure
 * Author: Kevin Roberts Fork from Vitor Henrique
 * License: AGPLv3
-----------------------------------------------------------------------------------------------------------------------*/
$(function() {
    function EnclosureViewModel(parameters) {
        var self = this;
        self.global_settings = parameters[0];
        self.connection = parameters[1];
        self.printerStateViewModel = parameters[2];
        self.temperature_reading = ko.observableArray();
        self.temperature_control = ko.observableArray();
        self.rpi_outputs = ko.observableArray();
        self.rpi_inputs = ko.observableArray();
        self.filamentSensorGcode = ko.observable();
        self.enclosureTemp = ko.observable();
        self.enclosureSetTemperature = ko.observable();
        self.enclosureHumidity = ko.observable();
        self.previousGpioStatus;
        self.eventEmail = ko.observable();
        self.email_reading = ko.observableArray();
        self.email_password = ko.observableArray();
        /**********************************************
        onDataUpdaterPluginMessage
        ***********************************************/
        self.onDataUpdaterPluginMessage = function(plugin, data) {
             if (plugin != "enclosure") {
                return;
            }
            if (data.hasOwnProperty("enclosuretemp")) {
                self.enclosureTemp(data.enclosuretemp);
            }
            if (data.hasOwnProperty("enclosureHumidity")) {
                self.enclosureHumidity(data.enclosureHumidity);
            }
            if (data.hasOwnProperty("enclosureSetTemp")){
                if (parseFloat(data.enclosureSetTemp)>0.0){
                  $("#enclosureSetTemp").attr("placeholder", data.enclosureSetTemp);
                }else{
                  $("#enclosureSetTemp").attr("placeholder", "off");
                }
            }
            if(!data.rpi_output){
              data.rpi_output = self.previousGpioStatus;
            }
            if(data.rpi_output){
              data.rpi_output.forEach(function(gpio) {
                  key = Object.keys(gpio)[0];
                  if(gpio[key]){
                    $("#btn_off_"+key).removeClass('active');
                    $("#btn_on_"+key).addClass('active');
                  }else{
                    $("#btn_off_"+key).addClass('active');
                    $("#btn_on_"+key).removeClass('active');
                  }
              });
              self.previousGpioStatus = data.rpi_output;
            }
            if (data.isMsg) {
                new PNotify({title:"Enclosure", text:data.msg, type: "error"});
            }
        };
        /**********************************************
        enableBtn
        ***********************************************/
        self.enableBtn = ko.computed(function() {
            return self.connection.loginState.isUser();
        });
        /**********************************************
        onBeforeBinding
        ***********************************************/
        self.onBeforeBinding = function () {
            self.settings = self.global_settings.settings.plugins.enclosure;
            self.temperature_reading(self.settings.temperature_reading());
            self.rpi_outputs(self.settings.rpi_outputs());
            self.rpi_inputs(self.settings.rpi_inputs());
            self.filamentSensorGcode(self.settings.filamentSensorGcode());
            self.email_reading(self.settings.email_reading());
            self.email_password(self.settings.email_password());
        };
        /**********************************************
        onStartupComplete
        ***********************************************/
        self.onStartupComplete = function () {
          self.getUpdateBtnStatus();
        };
        /**********************************************
        onSettingsShown
        ***********************************************/
        self.onSettingsShown = function(){
          self.fixUI();
          self.emailUI();
        };
        /**********************************************
        onSettingsHidden
        ***********************************************/
        self.onSettingsHidden = function(){
          self.getUpdateBtnStatus();
        };
        /**********************************************
        setTemperature
        ***********************************************/
        self.setTemperature = function(){
            if(self.isNumeric($("#enclosureSetTemp").val())){
                $.ajax({
                    url: "/plugin/enclosure/setEnclosureTemperature",
                    type: "GET",
                    dataType: "json",
                    data: {"enclosureSetTemp": Number($("#enclosureSetTemp").val())},
                     success: function(data) {
                        $("#enclosureSetTemp").val('');
                        $("#enclosureSetTemp").attr("placeholder", self.getStatusHeater(data.enclosureSetTemperature,data.enclosureCurrentTemperature));
                    }
                });
            }else{
                alert("Temperature is not a number");
            }
        };
        /**********************************************
        addRpiOutput
        ***********************************************/
        self.addRpiOutput = function(){
          self.global_settings.settings.plugins.enclosure.rpi_outputs.push({label: ko.observable("Ouput "+
            (self.global_settings.settings.plugins.enclosure.rpi_outputs().length+1)) ,
            gpioPin: 0,activeLow: true,
            autoStartup:ko.observable(false), startupTimeDelay:0, autoShutdown:ko.observable(false),shutdownTimeDelay:0});
        };
        /**********************************************
        removeRpiOutput
        ***********************************************/
        self.removeRpiOutput = function(definition) {
          self.global_settings.settings.plugins.enclosure.rpi_outputs.remove(definition);
        };
        /**********************************************
        addRpiInput
        ***********************************************/
        self.addRpiInput = function(){
          self.global_settings.settings.plugins.enclosure.rpi_inputs.push({label:ko.observable( "Input "+
          (self.global_settings.settings.plugins.enclosure.rpi_inputs().length+1)), gpioPin: 0,inputPull: "inputPullUp",
          eventType:ko.observable("temperature"),setTemp:100,controlledIO:ko.observable(""),setControlledIO:"low",
          edge:"fall",printerAction:"filament"});
        };
        /**********************************************
        removeRpiInput
        ***********************************************/
        self.removeRpiInput = function(definition) {
          self.global_settings.settings.plugins.enclosure.rpi_inputs.remove(definition);
        };
        /**********************************************
        turnOffHeater
        ***********************************************/
        self.turnOffHeater = function(){
            $.ajax({
                url: "/plugin/enclosure/setEnclosureTemperature",
                type: "GET",
                dataType: "json",
                data: {"enclosureSetTemp":0},
                 success: function(data) {
                    $("#enclosureSetTemp").val('');
                    $("#enclosureSetTemp").attr("placeholder", self.getStatusHeater(data.enclosureSetTemperature,data.enclosureCurrentTemperature));
                }
            });
        };
        /**********************************************
        clearGPIOMode
        ***********************************************/
        self.clearGPIOMode = function(){
            $.ajax({
                url: "/plugin/enclosure/clearGPIOMode",
                type: "GET",
                dataType: "json",
                 success: function(data) {
                   new PNotify({title:"Enclosure", text:"GPIO Mode cleared successfully", type: "success"});
                }
            });
        };
        /**********************************************
        getUpdateBtnStatus
        ***********************************************/
        self.getUpdateBtnStatus = function(){
            $.ajax({
                url: "/plugin/enclosure/getUpdateBtnStatus",
                type: "GET"
            });
        };
        /**********************************************
        requestEnclosureTemperature
        ***********************************************/
        self.requestEnclosureTemperature = function(){
            return $.ajax({
                    type: "GET",
                    url: "/plugin/enclosure/getEnclosureTemperature",
                    async: false
                }).responseText;
        };
        /**********************************************
        equestEnclosureSetTemperature
        ***********************************************/
        self.requestEnclosureSetTemperature = function(){
            return $.ajax({
                    type: "GET",
                    url: "/plugin/enclosure/getEnclosureSetTemperature",
                    async: false
                }).responseText;
        };
        /**********************************************
        getStatusHeater
        ***********************************************/
        self.getStatusHeater = function(setTemp,currentTemp){
            if (parseFloat(setTemp)>0.0){
                return cleanTemperature(setTemp);
            }
            return "off";
        };
        /**********************************************
        handleIO
        ***********************************************/
        self.handleIO = function(data, event){
            $.ajax({
                    type: "GET",
                    dataType: "json",
                    data: {"io": data[0], "status": data[1]},
                    url: "/plugin/enclosure/setIO",
                    async: false
            });
        };
        /**********************************************
        fixUI
        ***********************************************/
        self.fixUI = function(){
          if($('#enableTemperatureReading').is(':checked')){
            $('#enableHeater').prop('disabled', false);
            $('#temperature_reading_content').show("blind");
          }else{
            $('#enableHeater').prop('disabled', true);
            $('#enableHeater').prop('checked', false);
            $('#temperature_reading_content').hide("blind");
          }
          if($('#enableHeater').is(':checked')){
            $('#temperature_control_content').show("blind");
          }else{
            $('#temperature_control_content').hide("blind");
          }
        };
        
        /**********************************************
        emailUI
        ***********************************************/
        self.emailUI = function(){
          if($('#enableemail').is(':checked')){
             $('#isEmailEnabled').show("blind");
          }else{
            $('#isEmailEnabled').hide("blind");
          }
        };
        /**********************************************
        emailsslUI
        ***********************************************/
        self.emailsslUI = function(){
          if($('#emailSSL').is(':checked')){
             $('#isSSLEmailEnabled').show("blind");
          }else{
            $('#isSSLEmailEnabled').hide("blind");
          }
        };
        /**********************************************
        eventEmail
        ***********************************************/
        self.eventEmail = function(data,event) {
            $.ajax({
                type: "GET",
                url: "/plugin/enclosure/getEnclosureEmail",
                async: false
            });
        }
        /**********************************************
        isNumeric
        ***********************************************/
        self.isNumeric = function(n){
          return !isNaN(parseFloat(n)) && isFinite(n);
        };
    }
    /**********************************************
    EnclosureViewModel
    ***********************************************/
    OCTOPRINT_VIEWMODELS.push([
        EnclosureViewModel,
        ["settingsViewModel","connectionViewModel","printerStateViewModel"],
        ["#tab_plugin_enclosure","#settings_plugin_enclosure"]
    ]);
});
/**********************************************
End
=***********************************************/