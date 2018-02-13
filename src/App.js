import Draggable from 'react-draggable';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import _ from 'underscore';
import Select from 'react-select';
import 'react-select/dist/react-select.css';
import Extract from 'geojson-extract-geometries';
import Intersect from '@turf/intersect';

import NepalAdmin from './data/admin-nepal.json';

import './App.css';

const topojson = require('topojson-server');
const { features } = NepalAdmin;
const bckFeatures = NepalAdmin.features;

let provinces = _.uniq(features.map(feature => feature.properties.provinceId)).filter(Boolean).sort();
let districts = _.uniq(features.map(feature => feature.properties.districtId)).filter(Boolean).sort();
let municipalities = _.uniq(features.map(feature => feature.properties.NAME)).filter(Boolean).sort();

let geoJSONLayer = undefined;

class App extends Component {

    state = {
        selectedProvince: '',
        selectedDistrict: '',
        selectedMunicipality: '',
    }

    updateGeojson = (geofeatures) =>{
        if(geoJSONLayer) geoJSONLayer.clearLayers();
        geoJSONLayer = window.L.geoJSON(geofeatures,{
            onEachFeature: (feature,layer)=>{
                layer.bindPopup(feature.properties);
            },
            style : {
                'color': '#9b59b6'
            }
        }).addTo(this.map);
        this.map.fitBounds(geoJSONLayer.getBounds());
    }

    addGeojson = (features) => {
        this.updateGeojson(features);
        this.map.on(window.L.Draw.Event.CREATED,(e) => {
            let f1 = NepalAdmin.features;
            let f2 = [e.layer.toGeoJSON()];
            let intersections = [];
            for (let i = 0; i < f1.length; i++) {
                let parcel1 = f1[i];
                for (let j = 0; j <f2.length; j++) {
                    let parcel2 = f2[j];
                    try {
                        let conflict = Intersect(parcel2, parcel1);
                        if (conflict != null) {
                            intersections.push(conflict);
                        }
                    }
                    catch(err){
                    }
                }
            }
            this.updateGeojson(intersections);
        });
    }

    componentDidMount() {
        const map = this.map = window.L.map(ReactDOM.findDOMNode(this.refs['map']),{}).setView([28.2380, 83.9956], 3);
        window.L.tileLayer.grayscale('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        this.addGeojson(features);
        // FeatureGroup is to store editable layers
        var drawnItems = new window.L.FeatureGroup();
        map.addLayer(drawnItems);
        var drawControl = new window.L.Control.Draw({
            draw: {
                polygon: false,
                marker: false,
                circle : false,
                polyline : false
            }
        });
        map.addControl(drawControl);

    }

    handleProvinceChange = (selected) => {
        this.applyAppropriateGeoJSON(selected,'province');
        this.setState({
            selectedProvince: selected,
        });

    }

    applyAppropriateGeoJSON(selected,type){
        if(!selected) return;
        switch(type){
            case 'province':
                districts = _.uniq(features.filter(feature => feature.properties.provinceId === selected.value).map(feature => feature.properties.districtId)).filter(Boolean).sort();
                this.addGeojson(bckFeatures.filter((feature) => {
                    return feature.properties.provinceId === selected.value;
                }));
                break;
            case 'district':
                municipalities = _.uniq(features.filter(feature => feature.properties.districtId === selected.value).map(feature => feature.properties.NAME)).filter(Boolean).sort();
                this.addGeojson(bckFeatures.filter((feature) => {
                    return feature.properties.districtId === selected.value;
                }));
                break;
            default:
                this.addGeojson(bckFeatures.filter((feature) => {
                    return feature.properties.NAME === selected.value;
                }));

        }

    }

    handleDistrictChange = (selected) => {
        this.applyAppropriateGeoJSON(selected,'district');
        this.setState({
            selectedDistrict: selected,
        });

    }

    handleMunicipalityChange = (selected) => {
        this.applyAppropriateGeoJSON(selected,'municipality');
        this.setState({
            selectedMunicipality: selected,
        });
    }

    downloadGeoJSON = () => {
        this.initiateDownload(JSON.stringify(geoJSONLayer.toGeoJSON()),'geojson');
    }

    downloadTopoJSON = () => {
        const geoJSON = geoJSONLayer.toGeoJSON();
        const topojsonvalue = topojson.topology({ features: geoJSON });
        this.initiateDownload(JSON.stringify(topojsonvalue),'topojson');
    }

    downloadPoly = () => {
        const geoJSON = geoJSONLayer.toGeoJSON();
        let polies = Extract(geoJSON,'Polygon');
        let polyStr = '';
        const name = 'poly';
        polies.forEach((poly,ind) => {
            polyStr = polyStr + name + '-' + ind + '\n' + 1 + '\n';
            poly.coordinates[0].forEach((p) => {
                polyStr = polyStr + '\t' + p.join('\t') + '\n';
            });
            polyStr = polyStr + 'END\nEND\n';
        });
        this.initiateDownload(polyStr,'poly');
    }

    initiateDownload(obj,format){
        const dataStr = URL.createObjectURL( new Blob([(obj)],{type:'text/plain'}));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download",`downloadeddata.${format}`);
        dlAnchorElem.click();
    }

    render() {
        const { selectedProvince,selectedDistrict,selectedMunicipality } = this.state;
        const valueProvince = selectedProvince && selectedProvince.value;
        const valueDistrict = selectedDistrict && selectedDistrict.value;
        const valueMunicipality = selectedMunicipality && selectedMunicipality.value;
        return (
            <div>
                <div className="select-file">
                    <div className="row">
                        <h5> Download admin boundaries for Nepal</h5>
                    </div>
                    <div className="row">
                        <div className="col-4">
                            <Select
                                className="select"
                                placeholder = 'Select Province'
                                value={valueProvince}
                                onChange={this.handleProvinceChange}
                                options={provinces.map((province)=>{
                                    return {
                                        value : province,
                                        label : province,
                                    };
                                })}
                            />
                        </div>
                        <div className="col-4">
                            <Select
                                name="form-field-name"
                                className="select"
                                placeholder = 'Select District'
                                value={valueDistrict}
                                onChange={this.handleDistrictChange}
                                options={districts.map((district)=>{
                                    return {
                                        value : district,
                                        label : district,
                                    };
                                })}
                            />
                        </div>
                        <div className="col-4">
                            <Select
                                className="select"
                                placeholder = 'Select Municipality'
                                value={valueMunicipality}
                                onChange={this.handleMunicipalityChange}
                                options={municipalities.map((municipality)=>{
                                    return {
                                        value : municipality,
                                        label : municipality,
                                    };
                                })}
                            />
                        </div>
                    </div>
                    <br/>
                    <div className="row">
                        <div className="col-3"></div>
                        <div className="col-2">
                            <button className="download-geojson button-color-blue" onClick={this.downloadGeoJSON}> <i className="fa fa-download" aria-hidden="true"></i>   GeoJSON </button>
                        </div>
                        <div className="col-2">
                            <button className="download-geojson button-color-blue" onClick={this.downloadTopoJSON}> <i className="fa fa-download" aria-hidden="true"></i> TopoJSON </button>
                        </div>
                        <div className="col-2">
                            <button className="download-geojson button-color-blue" onClick={this.downloadPoly}> <i className="fa fa-download" aria-hidden="true"></i> Poly file </button>
                        </div>
                    </div>
                </div>
                <div ref={'map'} className="map"/>
            </div>
        );
    }
}

export default App;