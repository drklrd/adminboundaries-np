import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import _ from 'underscore';
import Select from 'react-select';
import 'react-select/dist/react-select.css';

import NepalAdmin from './data/admin-nepal.json';

import './App.css';

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

    addGeojson = (features) => {
        if(geoJSONLayer) geoJSONLayer.clearLayers();
        geoJSONLayer = window.L.geoJSON(features,{
            onEachFeature: (feature,layer)=>{
                layer.bindPopup(feature.properties);
            },
        }).addTo(this.map);
    }

    componentDidMount() {
        const map = this.map = window.L.map(ReactDOM.findDOMNode(this.refs['map']),{editable: true}).setView([28.2380, 83.9956], 8);
        window.L.tileLayer.grayscale('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        this.addGeojson(features);
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

        }

    }

    handleDistrictChange = (selected) => {
        this.applyAppropriateGeoJSON(selected,'district');
        this.setState({
            selectedDistrict: selected,
        });

    }

    handleMunicipalityChange = (selected) => {
        if(selected){
            this.addGeojson(bckFeatures.filter((feature) => {
                return feature.properties.NAME === selected.value;
            }));
        }
        this.setState({
            selectedMunicipality: selected,
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
                        <h4>Admin boundaries - Nepal</h4>
                    </div>
                    <div className="row">
                        <div className="col-4">
                            <Select
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
                </div>
                <div ref={'map'} className="map"/>
            </div>
        );
    }
}

export default App;