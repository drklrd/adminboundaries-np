import TurfArea from '@turf/area';
import TurfBuffer from '@turf/buffer';
import TurfBBox from '@turf/bbox';
import TurfCentroid from '@turf/centroid';
import Extract from 'geojson-extract-geometries';
import Intersect from '@turf/intersect';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import Select from 'react-select';
import _ from 'underscore';

import 'react-select/dist/react-select.css';
import './App.css';

import NepalAdmin from './data/admin-nepal.json';

const topojson = require('topojson-server');
const { features } = NepalAdmin;
const bckFeatures = NepalAdmin.features;

const getProvinceDistrictsMunicipalites = (key) =>{
    return _.uniq(features.map(feature => feature.properties[key])).filter(Boolean).sort();
};

let provinces,
    districts,
    municipalities;

const initializeDropdowns = () => {
    provinces = getProvinceDistrictsMunicipalites('provinceId');
    districts = getProvinceDistrictsMunicipalites('districtId');
    municipalities = getProvinceDistrictsMunicipalites('NAME');
};

let geoJSONLayer = undefined;

class App extends Component {

    constructor(props) {
        super(props);
        this.state = {
            selectedProvince: '',
            selectedDistrict: '',
            selectedMunicipality: '',
            bufferValue : 0
        };
    }

    componentWillMount(){
        initializeDropdowns();
    }

    renderPopup(properties){
        let template = '';
        function getTagValues(tags){
            for (let tag in tags){
                if(typeof tags[tag] !== 'object'){
                    template += `<strong> ${tag} </strong> : ${tags[tag]} <br/> `;
                }
            }
        }
        getTagValues(properties);
        getTagValues(properties.tags);
        return template;
    }

    updateGeojson = (geofeatures) =>{
        if(geoJSONLayer) geoJSONLayer.clearLayers();
        geoJSONLayer = window.L.geoJSON(geofeatures,{
            onEachFeature: (feature,layer)=>{
                layer.bindPopup(this.renderPopup(feature.properties));
            },
            style : (feature) => {
                if(!feature.properties.districtId) return;
                const color = feature.properties.provinceId % 2 === 0 ? '#003893' : '#dc143c';
                return {
                    color,
                    weight: 1.2,
                }
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
                            conflict.properties = parcel1.properties;
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
        const map = this.map = window.L.map(ReactDOM.findDOMNode(this.refs['map']),{ minZoom: 8}).setView([28.2380, 83.9956], 3);
        window.L.tileLayer.grayscale('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        this.addGeojson(features);

        const drawnItems = new window.L.FeatureGroup();
        map.addLayer(drawnItems);
        let drawControl = new window.L.Control.Draw({
            draw: {
                polygon: false,
                marker: false,
                circle : false,
                polyline : false
            }
        });
        map.addControl(drawControl);
        this.showSelectionInformation();

    }

    showSelectionInformation(){
        this.setState({
            showSelectionInfo : true,
            currentGeoJSON : geoJSONLayer.toGeoJSON()
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

        this.showSelectionInformation();
    }

    handleProvinceChange = (selected) => {
        this.applyAppropriateGeoJSON(selected,'province');
        this.setState({
            selectedProvince: selected,
        });
    }

    handleDistrictChange = (selected) => {
        this.applyAppropriateGeoJSON(selected,'district');
        this.setState({
            selectedDistrict: selected
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

    downloadOptions = () => {
        this.setState({
            downloadOptions : true
        });

    }

    downloadPoly = () => {
        let geoJSON = geoJSONLayer.toGeoJSON();
        if(this.state.bufferValue > 0) geoJSON = TurfBuffer(geoJSON, this.state.bufferValue, {units: 'kilometers'});
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
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        document.body.removeChild(dlAnchorElem);
    }

    clearSelections = () => {
        this.setState({
            selectedProvince: '',
            selectedDistrict: '',
            selectedMunicipality: '',
        });
        this.updateGeojson(bckFeatures);
        initializeDropdowns();
        this.showSelectionInformation();
    }

    bufferChange = (e) => {
        this.setState({
            bufferValue:  e.target.value,
        });
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
                        <div className="offset-1 col-3">
                            <Select
                                className="select"
                                placeholder = 'By Province'
                                value={valueProvince}
                                onChange={this.handleProvinceChange}
                                clearable = {false}
                                options={provinces.map((province)=>{
                                    return {
                                        value : province,
                                        label : province,
                                    };
                                })}
                            />
                        </div>
                        <div className="col-3">
                            <Select
                                className="select"
                                placeholder = 'By District'
                                value={valueDistrict}
                                onChange={this.handleDistrictChange}
                                clearable = {false}
                                options={districts.map((district)=>{
                                    return {
                                        value : district,
                                        label : district,
                                    };
                                })}
                            />
                        </div>
                        <div className="col-3">
                            <Select
                                className="select"
                                placeholder = 'By Municipality'
                                value={valueMunicipality}
                                onChange={this.handleMunicipalityChange}
                                clearable = {false}
                                options={municipalities.map((municipality)=>{
                                    return {
                                        value : municipality,
                                        label : municipality,
                                    };
                                })}
                            />
                        </div>
                        <div className="col-2">
                            <button className="download-geojson crimson" onClick={this.clearSelections}> <i className="fa fa-repeat" aria-hidden="true"></i> </button>
                        </div>
                    </div>
                    <br/>
                    {
                        this.state.showSelectionInfo &&
                        <div className="information">
                            <div className="row">
                                <div className="col-12">
                                    <ul> Bounding Box: {JSON.stringify(TurfBBox(this.state.currentGeoJSON).map((e)=>Number(e.toFixed(4))))} </ul>
                                </div>
                            </div>
                            <div className="row">
                                <div className="col-12">
                                    <ul> Area: {(TurfArea(this.state.currentGeoJSON)/(1000*1000)).toFixed(2)} sq.km  </ul>
                                </div>
                            </div>
                            <div className="row">
                                <div className="col-12">
                                    <ul> Centroid: {JSON.stringify(TurfCentroid(this.state.currentGeoJSON).geometry.coordinates.map((e)=>Number(e.toFixed(3))))} </ul>
                                </div>
                            </div>
                        </div>
                    }
                    <div className="row">
                        <div className="offset-1 col-3">
                            <button className="download-geojson button-color-blue" onClick={this.downloadGeoJSON}> <i className="fa fa-download" aria-hidden="true"></i>   GeoJSON </button>
                        </div>
                        <div className="col-3">
                            <button className="download-geojson button-color-blue" onClick={this.downloadTopoJSON}> <i className="fa fa-download" aria-hidden="true"></i> TopoJSON </button>
                        </div>
                        <div className="col-3">
                            <button className="download-geojson button-color-blue" onClick={this.downloadOptions}> <i className="fa fa-download" aria-hidden="true"></i> Poly file </button>
                        </div>
                    </div>
                    <br/>
                    {
                        this.state.downloadOptions &&
                        <div className="row">
                            <div className="offset-1 col-5">
                                Enter Buffer in Kilometers if needed (default 0)
                            </div>
                            <div className="col-2">
                                <input type="text" className="form-control" id="buffer" onChange={this.bufferChange} value={this.state.bufferValue} />
                            </div>
                            <div className="col-2">
                                <button className="download-geojson button-color-blue" onClick={this.downloadPoly}> <i className="fa fa-download" aria-hidden="true"></i>  </button>
                            </div>
                        </div>
                    }
                </div>
                <div ref={'map'} className="map"/>
            </div>
        );
    }
}

export default App;