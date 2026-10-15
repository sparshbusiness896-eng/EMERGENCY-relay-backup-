/**
 * ==============================================================================
 * Triage Relay: Interactive Emergency Hospital & Ambulance Map
 * ==============================================================================
 * Features:
 * - Static map displaying all hospital locations with custom medical markers
 * - Interactive hospital click popups showing:
 *   * Hospital Name
 *   * Distance from ambulance (km)
 *   * Estimated Arrival Time (ETA in minutes/seconds)
 *   * Contact Number
 *   * Emergency Bed Availability (ER, ICU, Trauma)
 *   * "Route Ambulance Here" one-click action
 * - Light blue glowing route polyline tracking the path to the selected hospital
 * - Seamless real-time location tracking for an ambulance moving along the route
 * - Responsive & user-friendly for both desktop and mobile devices
 * ==============================================================================
 */

// 1. HOSPITAL DIRECTORY DATASET
const MAP_HOSPITALS = [
  {
    id: "hos_001",
    name: "Apex Level-1 Trauma & Multi-Specialty Hospital",
    address: "Plot 14, Health City Parkway, Central Sector",
    phone: "+91-135-255-0101",
    lat: 30.3165,
    lng: 78.0322,
    status: "ACTIVE",
    capabilities: ["Level-1 Trauma", "24x7 Cath Lab", "Comprehensive Stroke", "Neurosurgery"],
    bedsAvailable: { ER: 8, ICU: 4, TRAUMA: 2 }
  },
  {
    id: "hos_002",
    name: "Metro Heart & Vascular Super-Specialty Institute",
    address: "88 Ring Road, South Medical Corridor",
    phone: "+91-135-255-0102",
    lat: 30.3050,
    lng: 78.0410,
    status: "ACTIVE",
    capabilities: ["Cardiac Care", "Cath Lab", "Vascular Surgery", "CT 24x7"],
    bedsAvailable: { ER: 6, ICU: 5, TRAUMA: 0 }
  },
  {
    id: "hos_003",
    name: "Comprehensive Neuro & Stroke Regional Hospital",
    address: "12 Civil Lines, West Wing",
    phone: "+91-135-255-0103",
    lat: 30.3290,
    lng: 78.0190,
    status: "ACTIVE",
    capabilities: ["Stroke Center", "Neurosurgery", "CT 24x7", "Blood Bank"],
    bedsAvailable: { ER: 5, ICU: 3, TRAUMA: 1 }
  },
  {
    id: "hos_004",
    name: "Children & Maternity Emergency Medical Center",
    address: "45 Shanti Path, Sector 4",
    phone: "+91-135-255-0104",
    lat: 30.3340,
    lng: 78.0550,
    status: "ACTIVE",
    capabilities: ["Pediatric Trauma", "Obstetrics Emergency", "Blood Bank"],
    bedsAvailable: { ER: 11, ICU: 2, PEDIATRIC_ICU: 3 }
  },
  {
    id: "hos_005",
    name: "St. Jude Burn & Emergency Trauma Center",
    address: "7 Industrial Bypass, East Zone",
    phone: "+91-135-255-0105",
    lat: 30.2980,
    lng: 78.0620,
    status: "ACTIVE",
    capabilities: ["Burn Unit", "Trauma Bay", "Blood Bank", "CT 24x7"],
    bedsAvailable: { ER: 4, ICU: 1, BURN: 3 }
  },
  {
    id: "hos_006",
    name: "Valley Orthopedic & Surgical Emergency Hospital",
    address: "19 Ridge View Road, North Foothills",
    phone: "+91-135-255-0106",
    lat: 30.3450,
    lng: 78.0080,
    status: "ACTIVE",
    capabilities: ["Orthopedics", "Vascular Surgery", "24x7 ER"],
    bedsAvailable: { ER: 6, ICU: 1, TRAUMA: 2 }
  },
  {
    id: "hos_007",
    name: "Central Memorial Level-2 Trauma Hospital",
    address: "102 Grand Trunk Ave, Old Cantonment",
    phone: "+91-135-255-0107",
    lat: 30.3120,
    lng: 78.0250,
    status: "ACTIVE",
    capabilities: ["Level-2 Trauma", "Blood Bank", "CT 24x7"],
    bedsAvailable: { ER: 5, ICU: 2, TRAUMA: 2 }
  },
  {
    id: "hos_008",
    name: "Riverside General & Emergency Care Center",
    address: "33 Riverbed Expressway, South End",
    phone: "+91-135-255-0108",
    lat: 30.2850,
    lng: 78.0480,
    status: "ACTIVE",
    capabilities: ["General Emergency", "CT 24x7", "Poison Center"],
    bedsAvailable: { ER: 3, ICU: 1, TRAUMA: 0 }
  },
  {
    id: "hos_009",
    name: "North Suburban General Hospital (ON DIVERSION)",
    address: "210 Highway Link, North Industrial Hub",
    phone: "+91-135-255-0109",
    lat: 30.3620,
    lng: 78.0120,
    status: "DIVERSION",
    capabilities: ["Cath Lab", "CT 24x7", "General ER"],
    bedsAvailable: { ER: 0, ICU: 0, TRAUMA: 0 }
  },
  {
    id: "hos_010",
    name: "Sunrise Emergency Community Clinic",
    address: "5 Bazar Gate, Downtown Market",
    phone: "+91-135-255-0110",
    lat: 30.3210,
    lng: 78.0370,
    status: "ACTIVE",
    capabilities: ["24x7 Emergency", "Poison Center"],
    bedsAvailable: { ER: 2, ICU: 0, TRAUMA: 0 }
  }
];

// 2. INTERACTIVE MAP CONTROLLER CLASS
class EmergencyDispatchMap {
  /**
   * @param {string} containerId - DOM container ID (e.g. 'liveNavigationMap')
   * @param {Object} options - Configuration options
   */
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      initialCenter: options.initialCenter || [30.3110, 78.0280], // Scene location
      initialZoom: options.initialZoom || 13,
      selectedHospitalId: options.selectedHospitalId || 'hos_001',
      speedKmH: options.speedKmH || 45, // Average emergency vehicle speed
      onTelemetryUpdate: options.onTelemetryUpdate || null,
      onArrival: options.onArrival || null,
      ...options
    };

    // State
    this.map = null;
    this.hospitals = MAP_HOSPITALS;
    this.hospitalMarkers = new Map();
    this.ambulanceMarker = null;
    this.routeGlowPolyline = null;
    this.routeMainPolyline = null;
    this.arrivalGeofenceCircle = null;

    // Ambulance State
    this.ambulance = {
      lat: 30.3110,
      lng: 78.0280,
      callSign: 'Ambulance 108 Alpha (ALS)',
      speedKmH: 45,
      routeWaypoints: [],
      currentIndex: 0,
      isMoving: false,
      selectedHospital: null
    };

    this.animationTimer = null;

    this.init();
  }

  /**
   * Initialize Leaflet Map, Layers, and Event Listeners
   */
  init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.warn(`[EmergencyDispatchMap] Container element #${this.containerId} not found.`);
      return;
    }

    // Ensure Leaflet is loaded
    if (typeof L === 'undefined') {
      console.error('[EmergencyDispatchMap] Leaflet.js library is not loaded. Please include Leaflet CSS and JS.');
      return;
    }

    // Create Map Instance
    this.map = L.map(this.containerId, {
      center: this.options.initialCenter,
      zoom: this.options.initialZoom,
      zoomControl: false,
      attributionControl: false
    });

    // Add Zoom Control at bottom-right for clean mobile UI
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // 1. Sleek, high-contrast dark tile layer (CartoDB Dark Matter)
    const darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    });

    // 2. OpenStreetMap fallback tile layer
    const osmTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    });

    darkTileLayer.addTo(this.map);

    // Render Hospitals & Ambulance
    this.renderHospitals();
    this.renderAmbulance();

    // Select initial hospital and build route
    this.selectHospital(this.options.selectedHospitalId, false);

    // Start Real-Time Ambulance Tracking Loop
    this.startTracking();

    // Handle Window Resize for Mobile & Responsive layouts
    window.addEventListener('resize', () => {
      if (this.map) this.map.invalidateSize();
    });
  }

  /**
   * Calculate Haversine straight-line distance in kilometers
   */
  calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }

  /**
   * Calculate Estimated Arrival Time (ETA) based on distance and emergency speed
   */
  calculateEta(distanceKm, speedKmH = 45) {
    // Road detour index factor ~1.35
    const roadDistanceKm = distanceKm * 1.35;
    const totalMinutes = (roadDistanceKm / speedKmH) * 60;
    const mins = Math.floor(totalMinutes);
    const secs = Math.round((totalMinutes - mins) * 60);

    return {
      totalSeconds: Math.round(totalMinutes * 60),
      minutes: mins,
      seconds: secs,
      formatted: mins < 1 ? `${secs} secs` : `${mins} min ${secs} sec`
    };
  }

  /**
   * Render All Static Hospital Locations on the Map with Custom Popups
   */
  renderHospitals() {
    this.hospitals.forEach(hospital => {
      const isDiversion = hospital.status === 'DIVERSION';

      // Custom HTML Marker Icon
      const iconHtml = `
        <div class="custom-hospital-marker ${isDiversion ? 'diversion' : 'active'}">
          <div class="hospital-icon-inner">🏥</div>
          <div class="hospital-marker-pulse"></div>
        </div>
      `;

      const hospitalIcon = L.divIcon({
        className: 'hospital-marker-wrapper',
        html: iconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -22]
      });

      const marker = L.marker([hospital.lat, hospital.lng], { icon: hospitalIcon }).addTo(this.map);

      // Bind Interactive Pop-up with Crucial Hospital Information
      marker.bindPopup(() => this.createHospitalPopupContent(hospital), {
        className: 'custom-emergency-popup',
        maxWidth: 320,
        minWidth: 260
      });

      // Update popup whenever it opens to show live distance & ETA from current ambulance location
      marker.on('click', () => {
        marker.setPopupContent(this.createHospitalPopupContent(hospital));
      });

      this.hospitalMarkers.set(hospital.id, marker);
    });
  }

  /**
   * Generates the Rich HTML Pop-up content for a Hospital
   */
  createHospitalPopupContent(hospital) {
    const isDiversion = hospital.status === 'DIVERSION';
    const isSelected = this.ambulance.selectedHospital?.id === hospital.id;

    // Calculate real-time distance and ETA from ambulance's current location
    const distKm = this.calculateDistanceKm(this.ambulance.lat, this.ambulance.lng, hospital.lat, hospital.lng);
    const eta = this.calculateEta(distKm, this.ambulance.speedKmH);

    const beds = hospital.bedsAvailable || {};
    const bedSummary = `
      <div class="popup-beds-grid">
        <span class="p-bed"><small>ER Free:</small> <strong>${beds.ER ?? 0}</strong></span>
        <span class="p-bed"><small>ICU Free:</small> <strong>${beds.ICU ?? 0}</strong></span>
        <span class="p-bed"><small>Trauma Free:</small> <strong>${beds.TRAUMA ?? 0}</strong></span>
      </div>
    `;

    return `
      <div class="hospital-popup-card">
        <div class="popup-header">
          <div class="popup-title-box">
            <h4 class="popup-hospital-name">${hospital.name}</h4>
            <span class="popup-status-badge ${isDiversion ? 'badge-diversion' : 'badge-active'}">
              ${isDiversion ? '⚠️ ON DIVERSION' : '✓ 24x7 EMERGENCY ACTIVE'}
            </span>
          </div>
        </div>

        <div class="popup-metrics-box">
          <div class="popup-metric">
            <span class="pm-label">📏 Distance</span>
            <span class="pm-val">${distKm} km</span>
          </div>
          <div class="popup-metric">
            <span class="pm-label">⏱️ Estimated Arrival</span>
            <span class="pm-val eta-highlight">${eta.formatted}</span>
          </div>
        </div>

        <div class="popup-detail-row">
          <span class="pd-icon">📞</span>
          <span class="pd-text"><strong>Contact:</strong> <a href="tel:${hospital.phone}" class="popup-tel">${hospital.phone}</a></span>
        </div>

        <div class="popup-detail-row">
          <span class="pd-icon">📍</span>
          <span class="pd-text">${hospital.address}</span>
        </div>

        <div class="popup-beds-section">
          ${bedSummary}
        </div>

        <div class="popup-actions">
          <button type="button" class="btn-popup-route ${isSelected ? 'selected' : ''}" 
                  onclick="window.emergencyMap.selectHospital('${hospital.id}', true)">
            ${isSelected ? '✓ Current Destination' : '🚑 Route Ambulance Here'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render Real-Time Ambulance Marker
   */
  renderAmbulance() {
    const ambulanceHtml = `
      <div class="ambulance-tracking-puck" id="ambulanceTrackingPuck">
        <div class="ambulance-beacon"></div>
        <div class="ambulance-body">🚑</div>
        <div class="ambulance-tag">${this.ambulance.callSign.split(' ')[1]}</div>
      </div>
    `;

    const ambulanceIcon = L.divIcon({
      className: 'ambulance-marker-wrapper',
      html: ambulanceHtml,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    this.ambulanceMarker = L.marker([this.ambulance.lat, this.ambulance.lng], {
      icon: ambulanceIcon,
      zIndexOffset: 1000
    }).addTo(this.map);

    this.ambulanceMarker.bindTooltip('🚑 108 Alpha • En Route', {
      permanent: false,
      direction: 'top',
      className: 'ambulance-tooltip'
    });
  }

  /**
   * Build realistic road waypoints between origin and destination
   */
  generateRouteWaypoints(origin, destination, numPoints = 60) {
    const waypoints = [];
    // Generate curved path with realistic turns along intersections
    for (let i = 0; i <= numPoints; i++) {
      const fraction = i / numPoints;
      // Add realistic street turn wave
      const curve1 = Math.sin(fraction * Math.PI) * 0.0035;
      const curve2 = Math.cos(fraction * Math.PI * 2) * 0.0015;

      const lat = origin.lat + (destination.lat - origin.lat) * fraction + curve1;
      const lng = origin.lng + (destination.lng - origin.lng) * fraction + curve2;

      waypoints.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
    }
    return waypoints;
  }

  /**
   * Select a Hospital, Draw the Light Blue Route, and Update Ambulance Path
   */
  selectHospital(hospitalId, animateMap = true) {
    const hospital = this.hospitals.find(h => h.id === hospitalId);
    if (!hospital) return;

    this.ambulance.selectedHospital = hospital;

    // 1. Remove previous route lines & geofence circle if any
    if (this.routeGlowPolyline) this.map.removeLayer(this.routeGlowPolyline);
    if (this.routeMainPolyline) this.map.removeLayer(this.routeMainPolyline);
    if (this.arrivalGeofenceCircle) this.map.removeLayer(this.arrivalGeofenceCircle);

    // 2. Generate path from current ambulance position to selected hospital
    this.ambulance.routeWaypoints = this.generateRouteWaypoints(
      { lat: this.ambulance.lat, lng: this.ambulance.lng },
      { lat: hospital.lat, lng: hospital.lng }
    );
    this.ambulance.currentIndex = 0;

    // 3. Draw Route in Light Blue
    // Outer Glow Polyline (Light Cyan / Neon Sky Blue)
    this.routeGlowPolyline = L.polyline(this.ambulance.routeWaypoints, {
      color: '#00e5ff',
      weight: 10,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    // Main Route Polyline (Vibrant Light Blue)
    this.routeMainPolyline = L.polyline(this.ambulance.routeWaypoints, {
      color: '#38bdf8', // Light Blue
      weight: 5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    // 4. Add 50m Arrival Geofence Circle around destination ED entrance
    this.arrivalGeofenceCircle = L.circle([hospital.lat, hospital.lng], {
      radius: 50, // 50 meters geofence (File 05 Section 6)
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.2,
      weight: 2,
      dashArray: '4, 4'
    }).addTo(this.map);

    // 5. Fit map bounds to show ambulance, route, and destination
    if (animateMap && this.map) {
      const bounds = L.latLngBounds([
        [this.ambulance.lat, this.ambulance.lng],
        [hospital.lat, hospital.lng]
      ]);
      this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    }

    // Notify listeners
    this.notifyTelemetry();
  }

  /**
   * Start Seamless Real-Time Ambulance Tracking Loop
   */
  startTracking() {
    if (this.animationTimer) clearInterval(this.animationTimer);
    this.ambulance.isMoving = true;

    // High-frequency animation update (every 180ms for buttery-smooth tracking)
    this.animationTimer = setInterval(() => {
      this.stepAmbulanceMovement();
    }, 180);
  }

  /**
   * Pause Tracking
   */
  pauseTracking() {
    this.ambulance.isMoving = false;
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  /**
   * Toggle Drive Simulation Play / Pause
   */
  toggleDrive() {
    if (this.ambulance.isMoving) {
      this.pauseTracking();
    } else {
      this.startTracking();
    }
    return this.ambulance.isMoving;
  }

  /**
   * Step Ambulance Movement smoothly along route waypoints
   */
  stepAmbulanceMovement() {
    if (!this.ambulance.routeWaypoints || this.ambulance.routeWaypoints.length === 0) return;

    // Advance index
    if (this.ambulance.currentIndex < this.ambulance.routeWaypoints.length - 1) {
      this.ambulance.currentIndex++;
      const [newLat, newLng] = this.ambulance.routeWaypoints[this.ambulance.currentIndex];

      this.ambulance.lat = newLat;
      this.ambulance.lng = newLng;

      // Update Ambulance Marker position seamlessly
      if (this.ambulanceMarker) {
        this.ambulanceMarker.setLatLng([newLat, newLng]);
      }

      // Shorten the polyline as ambulance moves forward
      const remainingWaypoints = this.ambulance.routeWaypoints.slice(this.ambulance.currentIndex);
      if (this.routeMainPolyline && remainingWaypoints.length > 1) {
        this.routeMainPolyline.setLatLngs(remainingWaypoints);
        this.routeGlowPolyline.setLatLngs(remainingWaypoints);
      }

      // Emit live telemetry update
      this.notifyTelemetry();

      // Check arrival condition (< 50m of hospital)
      if (this.ambulance.selectedHospital) {
        const distKm = this.calculateDistanceKm(
          newLat, newLng,
          this.ambulance.selectedHospital.lat,
          this.ambulance.selectedHospital.lng
        );

        if (distKm <= 0.05) { // Within 50 meters
          this.pauseTracking();
          if (typeof this.options.onArrival === 'function') {
            this.options.onArrival(this.ambulance.selectedHospital);
          }
        }
      }
    }
  }

  /**
   * Emit telemetry updates to HUD or callbacks
   */
  notifyTelemetry() {
    if (!this.ambulance.selectedHospital) return;

    const distKm = this.calculateDistanceKm(
      this.ambulance.lat, this.ambulance.lng,
      this.ambulance.selectedHospital.lat, this.ambulance.selectedHospital.lng
    );

    const eta = this.calculateEta(distKm, this.ambulance.speedKmH);

    const telemetry = {
      ambulanceLocation: { lat: this.ambulance.lat, lng: this.ambulance.lng },
      hospital: this.ambulance.selectedHospital,
      distanceKm: distKm,
      eta: eta,
      speedKmH: this.ambulance.speedKmH,
      isMoving: this.ambulance.isMoving,
      progressFraction: this.ambulance.currentIndex / (this.ambulance.routeWaypoints.length || 1)
    };

    if (typeof this.options.onTelemetryUpdate === 'function') {
      this.options.onTelemetryUpdate(telemetry);
    }

    // Update DOM HUD elements if present on page
    const navEtaEl = document.getElementById('navEtaValue');
    const navDistEl = document.getElementById('navDistanceValue');
    const navDestEl = document.getElementById('navDestName');

    if (navEtaEl) navEtaEl.textContent = `${String(eta.minutes).padStart(2, '0')}:${String(eta.seconds).padStart(2, '0')}`;
    if (navDistEl) navDistEl.textContent = `${distKm} km`;
    if (navDestEl) navDestEl.textContent = this.ambulance.selectedHospital.name;
  }

  /**
   * Recenter map on current ambulance location
   */
  recenterOnAmbulance() {
    if (this.map && this.ambulanceMarker) {
      this.map.panTo([this.ambulance.lat, this.ambulance.lng], { animate: true, duration: 0.8 });
    }
  }

  /**
   * Fit all hospital markers and ambulance within the viewport
   */
  fitAllLocations() {
    if (!this.map) return;
    const allCoords = this.hospitals.map(h => [h.lat, h.lng]);
    allCoords.push([this.ambulance.lat, this.ambulance.lng]);
    this.map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40] });
  }
}

// 3. EXPORT / BIND GLOBALLY FOR EASY INTEGRATION
if (typeof window !== 'undefined') {
  window.EmergencyDispatchMap = EmergencyDispatchMap;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmergencyDispatchMap, MAP_HOSPITALS };
}
