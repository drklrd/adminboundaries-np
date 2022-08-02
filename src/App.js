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

import NepalAdmin from './data/adminNepalSimplified.json';

const topojson = require('topojson-server');

const { features } = NepalAdmin;
const bckFeatures = NepalAdmin.features;

let collection = [];

const getProvinceDistrictsMunicipalites = key => _.uniq(features.map(feature => feature.properties[key])).filter(Boolean).sort();

let provinces,
    districts,
    municipalities;

const initializeDropdowns = () => {
    provinces = getProvinceDistrictsMunicipalites('Province');
    districts = getProvinceDistrictsMunicipalites('DISTRICT');
    municipalities = getProvinceDistrictsMunicipalites('GaPa_NaPa');
};


let geoJSONLayer;

class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            selectedProvince: '',
            selectedDistrict: '',
            selectedMunicipality: '',
            bufferValue: 0,
        };
    }

    componentWillMount() {
        initializeDropdowns();
        console.log('municipalities', municipalities);
    }

    renderPopup(properties) {
        let template = '';
        function getTagValues(tags) {
            for (const tag in tags) {
                if (typeof tags[tag] !== 'object') {
                    template += `<strong> ${tag} </strong> : ${tags[tag]} <br/> `;
                }
            }
        }
        getTagValues(properties);
        getTagValues(properties.tags);
        return template;
    }

    updateGeojson = (geofeatures) => {
        if (geoJSONLayer) geoJSONLayer.clearLayers();
        geoJSONLayer = window.L.geoJSON(geofeatures, {
            onEachFeature: (feature, layer) => {
                layer.bindPopup(this.renderPopup(feature.properties));
            },
            style: (feature) => {
                if (!feature.properties.DISTRICT) return;
                const color = !isNaN(Number(feature.properties.Province)) ? '#003893' : '#dc143c';
                return {
                    color,
                    weight: 0.5,
                };
            },
        }).addTo(this.map);
        this.map.fitBounds(geoJSONLayer.getBounds());
    }

    addGeojson = (features) => {
        this.updateGeojson(features);
        this.map.on(window.L.Draw.Event.CREATED, (e) => {
            const f1 = NepalAdmin.features;
            const f2 = [e.layer.toGeoJSON()];
            const intersections = [];
            for (let i = 0; i < f1.length; i++) {
                const parcel1 = f1[i];
                for (let j = 0; j < f2.length; j++) {
                    const parcel2 = f2[j];
                    try {
                        const conflict = Intersect(parcel2, parcel1);
                        if (conflict != null) {
                            conflict.properties = parcel1.properties;
                            intersections.push(conflict);
                        }
                    } catch (err) {
                    }
                }
            }
            this.updateGeojson(intersections);
        });
    }

    componentDidMount() {
        const map = this.map = window.L.map(ReactDOM.findDOMNode(this.refs.map), { minZoom: 8 }).setView([28.2380, 83.9956], 3);
        window.L.tileLayer.grayscale('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: 'Map &copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors | Boundary data taken from <a href="http://localboundries.oknp.org/">Local Boundaries (OKNP)</a>',
        }).addTo(map);
        this.addGeojson(features);

        const drawnItems = new window.L.FeatureGroup();
        map.addLayer(drawnItems);
        const drawControl = new window.L.Control.Draw({
            draw: {
                polygon: false,
                marker: false,
                circle: false,
                polyline: false,
            },
        });
        map.addControl(drawControl);
        this.showSelectionInformation();
    }

    showSelectionInformation() {
        this.setState({
            showSelectionInfo: true,
            currentGeoJSON: geoJSONLayer.toGeoJSON(),
        });
    }

    applyAppropriateGeoJSON(selected, type) {
        if (!selected) return;
        switch (type) {
            case 'province':
                districts = _.uniq(features.filter(feature => feature.properties.Province === selected.value).map(feature => feature.properties.DISTRICT)).filter(Boolean).sort();
                this.addGeojson(bckFeatures.filter(feature => feature.properties.Province === selected.value));
                break;
            case 'district':
                municipalities = _.uniq(features.filter(feature => feature.properties.DISTRICT === selected.value).map(feature => feature.properties.GaPa_NaPa)).filter(Boolean).sort();
                this.addGeojson(bckFeatures.filter(feature => feature.properties.DISTRICT === selected.value));
                break;
            default:
                console.log('selected', selected);
                this.addGeojson(bckFeatures.filter(feature => feature.properties.GaPa_NaPa === selected.value));
        }

        this.showSelectionInformation();
    }

    handleProvinceChange = (selected) => {
        this.applyAppropriateGeoJSON(selected, 'province');
        this.setState({
            selectedProvince: selected,
        });
    }

    handleDistrictChange = (selected) => {
        this.applyAppropriateGeoJSON(selected, 'district');
        this.setState({
            selectedDistrict: selected,
        });
    }

    handleMunicipalityChange = (selected) => {
        this.applyAppropriateGeoJSON(selected, 'municipality');
        this.setState({
            selectedMunicipality: selected,
        });
    }

    handleAddToCollection = () => {
        collection = collection.concat(geoJSONLayer.toGeoJSON());
    }

    getActualAdminDataFromTemplate = (data) => {
        const adminData = {
            type: 'FeatureCollection',
            features: [],
        };
        const templateGeojson = geoJSONLayer.toGeoJSON();
        templateGeojson.features.forEach((tf) => {
            data.features.forEach((df) => {
                if (df.properties.uuid == tf.properties.uuid) {
                    adminData.features.push(df);
                }
            });
        });
        return adminData;
    }

    prepareDownload = () => fetch('js/data/adminNepal.json')
        .then(res => res.json())

    downloadGeoJSON = () => {
        this.prepareDownload()
            .then((data) => {
                const geoJSON = this.getActualAdminDataFromTemplate(data);
                this.initiateDownload(JSON.stringify(geoJSON), 'geojson');
            });
    }

    downloadTopoJSON = () => {
        this.prepareDownload()
            .then((data) => {
                const geoJSON = this.getActualAdminDataFromTemplate(data);
                const topojsonvalue = topojson.topology({ features: geoJSON });
                this.initiateDownload(JSON.stringify(topojsonvalue), 'topojson');
            });
    }

    downloadOptions = () => {
        this.setState({
            downloadOptions: true,
        });
    }

    downloadPoly = () => {
        this.prepareDownload()
            .then((data) => {
                let geoJSON = this.getActualAdminDataFromTemplate(data);
                if (this.state.bufferValue > 0) geoJSON = TurfBuffer(geoJSON, this.state.bufferValue, { units: 'kilometers' });
                const polies = Extract(geoJSON, 'Polygon');
                let polyStr = '';
                const name = 'poly';
                polies.forEach((poly, ind) => {
                    polyStr = `${polyStr + name}-${ind}\n${1}\n`;
                    poly.coordinates[0].forEach((p) => {
                        polyStr = `${polyStr}\t${p.join('\t')}\n`;
                    });
                    polyStr += 'END\nEND\n';
                });
                this.initiateDownload(polyStr, 'poly');
            });
    }

    initiateDownload(obj, format) {
        const dataStr = URL.createObjectURL(new Blob([(obj)], { type: 'text/plain' }));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute('href', dataStr);
        dlAnchorElem.setAttribute('download', `downloadeddata.${format}`);
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
        collection = [];
        this.updateGeojson(bckFeatures);
        initializeDropdowns();
        this.showSelectionInformation();
    }

    bufferChange = (e) => {
        this.setState({
            bufferValue: e.target.value,
        });
    }

    render() {
        const { selectedProvince, selectedDistrict, selectedMunicipality } = this.state;
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
                                placeholder="By Province"
                                value={valueProvince}
                                onChange={this.handleProvinceChange}
                                clearable={false}
                                options={provinces.map(province => ({
                                    value: province,
                                    label: province,
                                }))}
                            />
                        </div>
                        <div className="col-3">
                            <Select
                                className="select"
                                placeholder="By District"
                                value={valueDistrict}
                                onChange={this.handleDistrictChange}
                                clearable={false}
                                options={districts.map(district => ({
                                    value: district,
                                    label: district,
                                }))}
                            />
                        </div>
                        <div className="col-3">
                            <Select
                                className="select"
                                placeholder="By Municipality"
                                value={valueMunicipality}
                                onChange={this.handleMunicipalityChange}
                                clearable={false}
                                options={municipalities.map(municipality => ({
                                    value: municipality,
                                    label: municipality,
                                }))}
                            />
                        </div>
                        <div className="col-1">
                            <button className="download-geojson crimson" onClick={this.clearSelections}> <i className="fa fa-repeat" aria-hidden="true" /> </button>
                        </div>
                        <div className="col-1">
                            <button className="download-geojson button-color-blue" onClick={this.handleAddToCollection}> <i className="fa fa-plus-circle" aria-hidden="true" />  </button>
                        </div>
                    </div>
                    <br />
                    {
                        this.state.showSelectionInfo &&
                        <div className="information">
                            <div className="row">
                                <div className="col-8">
                                    <ul> Bounding Box: {JSON.stringify(TurfBBox(this.state.currentGeoJSON).map(e => Number(e.toFixed(4))))} </ul>
                                </div>
                            </div>
                            <div className="row">
                                <div className="col-12">
                                    <ul> Area: {(TurfArea(this.state.currentGeoJSON) / (1000 * 1000)).toFixed(2)} sq.km  </ul>
                                </div>
                            </div>
                            <div className="row">
                                <div className="col-12">
                                    <ul> Centroid: {JSON.stringify(TurfCentroid(this.state.currentGeoJSON).geometry.coordinates.map(e => Number(e.toFixed(3))))} </ul>
                                </div>
                            </div>
                        </div>
                    }
                    <div className="row">
                        <div className="offset-1 col-3">
                            <button className="download-geojson button-color-blue" onClick={this.downloadGeoJSON}> <i className="fa fa-download" aria-hidden="true" />   GeoJSON </button>
                        </div>
                        <div className="col-3">
                            <button className="download-geojson button-color-blue" onClick={this.downloadTopoJSON}> <i className="fa fa-download" aria-hidden="true" /> TopoJSON </button>
                        </div>
                        <div className="col-3">
                            <button className="download-geojson button-color-blue" onClick={this.downloadOptions}> <i className="fa fa-download" aria-hidden="true" /> Poly file </button>
                        </div>
                    </div>
                    <br />
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
                                <button className="download-geojson button-color-blue" onClick={this.downloadPoly}> <i className="fa fa-download" aria-hidden="true" />  </button>
                            </div>
                        </div>
                    }
                </div>
                <div ref="map" className="map" />
            </div>
        );
    }
}

export default App;
