/*
 * L.Control.OrderLayers is a control to allow users to switch between different layers on the map.
 */

L.Control.OrderLayers = L.Control.Layers.extend({
  options: {
    dragging: false,
  },

  _addDragAndDrop: function () {
    var self = this;
    Sortable.create(this._overlaysList, {
      animation: 150,
      onMove: (evt, originalEvent) => {
        var objDragged = self._getLayer(evt.dragged.layerId);
        var objRelated = self._getLayer(evt.related.layerId);
        var zIndexDragged = self._getZIndex(objDragged);
        var zIndexRelated = self._getZIndex(objRelated);
        objDragged.layer.setZIndex(zIndexRelated);
        objRelated.layer.setZIndex(zIndexDragged);
      },
      onEnd: (evt) => {
        self._map.fire("changelayers");
        self._update();
      },
    });
  },

  onAdd: function (map) {
    this._initLayout();
    this._update();

    this._map = map;

    map.on("zoomend", this._checkDisabledLayers, this);

    for (var i = 0; i < this._layers.length; i++) {
      this._layers[i].layer.on("add remove", this._onLayerChange, this);
    }

    if (this.options.dragging) {
      this._addDragAndDrop();
    }

    return this._container;
  },

  _update: function () {
    if (!this._container) {
      return;
    }

    L.DomUtil.empty(this._baseLayersList);
    L.DomUtil.empty(this._overlaysList);

    this._layerControlInputs = [];
    var baseLayersPresent,
      overlaysPresent,
      i,
      obj,
      baseLayersCount = 0;

    var overlaysLayers = [];
    for (i = 0; i < this._layers.length; i++) {
      obj = this._layers[i];
      if (!obj.overlay) this._addItem(obj);
      else {
        var zIndex = this._getZIndex(obj);
        overlaysLayers[zIndex] = obj;
      }

      overlaysPresent = overlaysPresent || obj.overlay;
      baseLayersPresent = baseLayersPresent || !obj.overlay;
      baseLayersCount += !obj.overlay ? 1 : 0;
    }

    for (i = overlaysLayers.length - 1; i >= 0; i--) {
      if (overlaysLayers[i]) this._addItem(overlaysLayers[i]);
    }

    // Hide base layers section if there's only one layer.
    if (this.options.hideSingleBase) {
      baseLayersPresent = baseLayersPresent && baseLayersCount > 1;
      this._baseLayersList.style.display = baseLayersPresent ? "" : "none";
    }

    this._separator.style.display = overlaysPresent && baseLayersPresent ? "" : "none";
    return this;
  },

  _addItem: function (obj) {
    var leafletRow = L.DomUtil.create("div", "leaflet-row");

    var label = document.createElement("label"),
      checked = this._map.hasLayer(obj.layer),
      input;

    if (obj.overlay) {
      input = document.createElement("input");
      input.type = "checkbox";
      input.className = "leaflet-control-layers-selector";
      input.defaultChecked = checked;
    } else {
      input = this._createRadioElement("leaflet-base-layers_" + L.Util.stamp(this), checked);
    }

    this._layerControlInputs.push(input);
    input.layerId = L.Util.stamp(obj.layer);

    if (this.options.dragging) {
      leafletRow.layerId = input.layerId;
    }

    L.DomEvent.on(input, "click", this._onInputClick, this);

    var name = document.createElement("span");
    name.innerHTML = " " + obj.name;

    var leafletInput = L.DomUtil.create("div", "leaflet-input");
    leafletInput.appendChild(input);
    var icon = L.DomUtil.create("label", "leaflet-icon");
    icon.htmlFor = input.id;
    leafletInput.appendChild(icon);
    leafletRow.appendChild(leafletInput);

    var leafletName = L.DomUtil.create("div", "leaflet-name");
    label.htmlFor = input.id;
    leafletName.appendChild(label);
    label.appendChild(name);
    leafletRow.appendChild(leafletName);

    var container;
    if (obj.overlay) {
      if (!this.options.dragging) {
        // Up button
        var leafletUp = L.DomUtil.create("div", "leaflet-up");
        L.DomEvent.on(leafletUp, "click", this._onUpClick, this);
        leafletUp.layerId = input.layerId;
        leafletRow.appendChild(leafletUp);
        // Down button
        var leafletDown = L.DomUtil.create("div", "leaflet-down");
        leafletDown.layerId = input.layerId;
        L.DomEvent.on(leafletDown, "click", this._onDownClick, this);
        leafletRow.appendChild(leafletDown);
      }

      container = this._overlaysList;
    } else {
      container = this._baseLayersList;
    }

    container.appendChild(leafletRow);
    this._checkDisabledLayers();
    return label;
  },

  _onDownClick: function (e) {
    var layerId = e.currentTarget.layerId;
    var obj = this._getLayer(layerId);

    if (!obj.overlay) {
      return;
    }

    var inputs = this._layerControlInputs;
    var replaceLayer = null;
    var idx = this._getZIndex(obj);
    for (var i = 0; i < inputs.length; i++) {
      var auxLayer = this._getLayer(inputs[i].layerId);
      var auxIdx = this._getZIndex(auxLayer);
      if (auxLayer.overlay && idx - 1 === auxIdx) {
        replaceLayer = auxLayer;
        break;
      }
    }

    var newZIndex = idx - 1;
    if (replaceLayer) {
      obj.layer.setZIndex(newZIndex);
      replaceLayer.layer.setZIndex(newZIndex + 1);
      this._update();
      this._map.fire("changelayers");
    }
  },

  _onUpClick: function (e) {
    var layerId = e.currentTarget.layerId;
    var obj = this._getLayer(layerId);

    if (!obj.overlay) {
      return;
    }

    var inputs = this._layerControlInputs;
    var replaceLayer = null;
    var idx = this._getZIndex(obj);
    for (var i = 0; i < inputs.length; i++) {
      var auxLayer = this._getLayer(inputs[i].layerId);
      var auxIdx = this._getZIndex(auxLayer);
      if (auxLayer.overlay && idx + 1 === auxIdx) {
        replaceLayer = auxLayer;
        break;
      }
    }

    var newZIndex = idx + 1;
    if (replaceLayer) {
      obj.layer.setZIndex(newZIndex);
      replaceLayer.layer.setZIndex(newZIndex - 1);
      this._update();
      this._map.fire("changelayers");
    }
  },

  _addLayer: function (layer, name, overlay) {
    if (this._map) {
      layer.on("add remove", this._onLayerChange, this);
    }

    this._layers.push({
      layer: layer,
      name: name,
      overlay: overlay,
    });

    if (this.options.sortLayers) {
      this._layers.sort(
        Util.bind(function (a, b) {
          return this.options.sortFunction(a.layer, b.layer, a.name, b.name);
        }, this)
      );
    }

    if (this.options.autoZIndex && layer.setZIndex) {
      this._lastZIndex++;
      layer.setZIndex(this._lastZIndex);
    }

    this._expandIfNotCollapsed();
  },

  _getZIndex: function (obj) {
    var zIndex = 9999999999;

    if (obj.layer.options && obj.layer.options.zIndex) {
      zIndex = obj.layer.options.zIndex;
    } else if (obj.layer.getLayers && obj.layer.eachLayer) {
      obj.layer.eachLayer((layer) =>
        layer.options && layer.options.zIndex
          ? (zIndex = Math.min(layer.options.zIndex, zIndex))
          : null
      );
    }
    return zIndex;
  },
});

L.control.orderlayers = function (baseLayers, overlays, options) {
  return new L.Control.OrderLayers(baseLayers, overlays, options);
};
