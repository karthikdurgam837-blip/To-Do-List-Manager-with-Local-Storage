import React, { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, Pin, useMap, useMapsLibrary, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { LatLng, MapPlace, MapRoute } from '../types';
import { Compass, Navigation, Search, MapPin, Star, Route as RouteIcon, Info, Trash2 } from 'lucide-react';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface MapContainerProps {
  center: LatLng;
  zoom: number;
  placesQuery: { query: string; category?: string } | null;
  routeQuery: { origin: string; destination: string; travelMode: string } | null;
  focusQuery: string | null;
  onPlacesFound: (places: MapPlace[]) => void;
  onRouteComputed: (route: MapRoute | null) => void;
  onClearAll: () => void;
}

export default function MapContainer({
  center,
  zoom,
  placesQuery,
  routeQuery,
  focusQuery,
  onPlacesFound,
  onRouteComputed,
  onClearAll,
}: MapContainerProps) {
  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-slate-900 text-slate-100 p-8 rounded-2xl border border-slate-800 font-sans shadow-xl">
        <div className="text-center max-w-lg">
          <div className="inline-flex p-4 rounded-full bg-blue-500/10 text-blue-400 mb-6 border border-blue-500/20">
            <Compass className="w-10 h-10 animate-spin" style={{ animationDuration: '8s' }} />
          </div>
          <h2 className="text-2xl font-bold mb-4 text-white">Google Maps API Key Required</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            This interactive map-based chatbot requires a Google Maps Platform API key to search, route, and render map features.
          </p>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 text-left text-xs space-y-3 shadow-inner">
            <p className="text-blue-400 font-medium">To configure your API Key:</p>
            <ol className="list-decimal list-inside space-y-2 text-slate-400 leading-relaxed">
              <li>
                <a
                  href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  Get an API Key from Google Cloud Console <span className="text-[10px]">↗</span>
                </a>
              </li>
              <li>
                Open <strong>Settings</strong> (⚙️ gear icon, top-right corner of AI Studio)
              </li>
              <li>
                Select <strong>Secrets</strong>
              </li>
              <li>
                Add <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the secret name, and paste your API key as the value.
              </li>
            </ol>
          </div>
          <p className="text-[11px] text-slate-500 mt-4 italic">
            The application will rebuild automatically once the key is added.
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly">
      <MapInner
        center={center}
        zoom={zoom}
        placesQuery={placesQuery}
        routeQuery={routeQuery}
        focusQuery={focusQuery}
        onPlacesFound={onPlacesFound}
        onRouteComputed={onRouteComputed}
        onClearAll={onClearAll}
      />
    </APIProvider>
  );
}

// Inner component which lives inside APIProvider to gain access to hooks
function MapInner({
  center,
  zoom,
  placesQuery,
  routeQuery,
  focusQuery,
  onPlacesFound,
  onRouteComputed,
  onClearAll,
}: MapContainerProps) {
  const map = useMap();
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const [computedRoute, setComputedRoute] = useState<MapRoute | null>(null);
  const [infoWindowOpen, setInfoWindowOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<LatLng>(center);
  const [mapZoom, setMapZoom] = useState<number>(zoom);

  // References for Advanced Markers to bind InfoWindows properly
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const markerRefs = useRef<{ [key: string]: google.maps.marker.AdvancedMarkerElement | null }>({});

  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');
  const geocodingLib = useMapsLibrary('geocoding');

  // 1. Listen to Focus Query (focus_on_location)
  useEffect(() => {
    if (!geocodingLib || !map || !focusQuery) return;

    const geocoder = new geocodingLib.Geocoder();
    geocoder.geocode({ address: focusQuery }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const location = results[0].geometry.location;
        map.panTo(location);
        map.setZoom(14);
        setMapCenter({ lat: location.lat(), lng: location.lng() });
        setMapZoom(14);
      } else {
        console.warn('Geocoding failed for focus query:', focusQuery);
      }
    });
  }, [geocodingLib, map, focusQuery]);

  // 2. Listen to Places Query (show_places_on_map)
  useEffect(() => {
    if (!placesLib || !map || !placesQuery) return;

    const bias = map.getCenter();
    placesLib.Place.searchByText({
      textQuery: placesQuery.query,
      fields: ['id', 'displayName', 'location', 'formattedAddress', 'types', 'rating', 'photos'],
      locationBias: bias || undefined,
      maxResultCount: 15,
    })
      .then(({ places: searchResults }) => {
        if (searchResults && searchResults.length > 0) {
          const mapped: MapPlace[] = searchResults.map(p => ({
            id: p.id,
            name: p.displayName || 'Unnamed Place',
            formattedAddress: p.formattedAddress || '',
            location: { lat: p.location.lat(), lng: p.location.lng() },
            rating: p.rating || undefined,
            types: p.types || [],
            photoUrl: p.photos?.[0]?.getURI({ maxWidth: 400 }) || undefined,
          }));

          setPlaces(mapped);
          onPlacesFound(mapped);

          // Fit bounds to show all markers
          const bounds = new google.maps.LatLngBounds();
          mapped.forEach(p => bounds.extend(p.location));
          map.fitBounds(bounds);

          // Select the first place by default
          setSelectedPlace(mapped[0]);
          setActiveMarkerId(mapped[0].id);
          setInfoWindowOpen(true);
        } else {
          setPlaces([]);
          onPlacesFound([]);
        }
      })
      .catch(err => {
        console.error('Places Search failed:', err);
      });
  }, [placesLib, map, placesQuery]);

  // 3. Listen to Route Query (get_directions)
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  useEffect(() => {
    if (!routesLib || !map || !routeQuery) {
      // Clear route polylines if routeQuery is null
      polylinesRef.current.forEach(p => p.setMap(null));
      polylinesRef.current = [];
      setComputedRoute(null);
      return;
    }

    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    routesLib.Route.computeRoutes({
      origin: routeQuery.origin,
      destination: routeQuery.destination,
      travelMode: routeQuery.travelMode as google.maps.TravelMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    })
      .then(({ routes }) => {
        if (routes && routes[0]) {
          const route = routes[0];
          const newPolylines = route.createPolylines();
          newPolylines.forEach(p => p.setMap(map));
          polylinesRef.current = newPolylines;

          if (route.viewport) {
            map.fitBounds(route.viewport);
          }

          const distMeters = route.distanceMeters || 0;
          const durMillis = Number(route.durationMillis || 0);
          const distanceStr =
            distMeters > 1000 ? `${(distMeters / 1000).toFixed(1)} km` : `${distMeters} m`;
          const durationStr = `${Math.round(durMillis / 60000)} mins`;

          const pathCoords = route.path.map(pt => ({ lat: pt.lat, lng: pt.lng }));

          const computed: MapRoute = {
            origin: routeQuery.origin,
            destination: routeQuery.destination,
            travelMode: routeQuery.travelMode,
            distance: distanceStr,
            duration: durationStr,
            path: pathCoords,
          };

          setComputedRoute(computed);
          onRouteComputed(computed);
        }
      })
      .catch(err => {
        console.error('Route compute failed:', err);
        onRouteComputed(null);
      });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, routeQuery]);

  // Handle manual clearing of all state
  const handleClear = () => {
    setPlaces([]);
    setSelectedPlace(null);
    setActiveMarkerId(null);
    setInfoWindowOpen(false);
    setComputedRoute(null);
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    onClearAll();
  };

  const getMarkerPinColor = (place: MapPlace) => {
    if (selectedPlace?.id === place.id) return '#ef4444'; // Red for selected
    if (place.types?.includes('restaurant') || place.types?.includes('food')) return '#f97316'; // Orange
    if (place.types?.includes('museum') || place.types?.includes('art_gallery')) return '#8b5cf6'; // Purple
    if (place.types?.includes('park') || place.types?.includes('tourist_attraction')) return '#10b981'; // Green
    return '#3b82f6'; // Blue default
  };

  return (
    <div className="relative w-full h-full flex flex-col md:flex-row bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      {/* Places & Route List Side Panel */}
      {(places.length > 0 || computedRoute) && (
        <div className="w-full md:w-80 bg-slate-950 border-r border-slate-800 flex flex-col h-48 md:h-full z-10 overflow-y-auto">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 sticky top-0 backdrop-blur-md">
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">
              {computedRoute ? 'Route Details' : `Places Found (${places.length})`}
            </span>
            <button
              onClick={handleClear}
              className="text-slate-400 hover:text-red-400 transition-colors p-1.5 hover:bg-slate-800 rounded-lg"
              title="Clear map elements"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Route Panel */}
          {computedRoute && (
            <div className="p-4 border-b border-slate-800 bg-blue-500/5 space-y-3">
              <div className="flex items-center gap-2 text-blue-400">
                <RouteIcon className="w-5 h-5" />
                <span className="font-semibold text-sm">Active Route</span>
              </div>
              <div className="space-y-1 text-xs">
                <p className="text-slate-400">
                  <span className="font-medium text-slate-300">From:</span> {computedRoute.origin}
                </p>
                <p className="text-slate-400">
                  <span className="font-medium text-slate-300">To:</span> {computedRoute.destination}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Distance</span>
                  <span className="text-sm font-semibold text-slate-200">{computedRoute.distance}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Duration</span>
                  <span className="text-sm font-semibold text-slate-200">{computedRoute.duration}</span>
                </div>
              </div>
            </div>
          )}

          {/* Places List */}
          {places.length > 0 && !computedRoute && (
            <div className="divide-y divide-slate-800/60 overflow-y-auto flex-1">
              {places.map(place => (
                <button
                  key={place.id}
                  onClick={() => {
                    setSelectedPlace(place);
                    setActiveMarkerId(place.id);
                    setInfoWindowOpen(true);
                    map?.panTo(place.location);
                  }}
                  className={`w-full text-left p-3.5 hover:bg-slate-900/60 transition-colors flex items-start gap-3 border-l-2 ${
                    selectedPlace?.id === place.id ? 'border-red-500 bg-red-500/5' : 'border-transparent'
                  }`}
                >
                  <MapPin
                    className="w-4 h-4 mt-1 flex-shrink-0"
                    style={{ color: getMarkerPinColor(place) }}
                  />
                  <div className="min-w-0 space-y-1">
                    <h4 className="font-medium text-slate-200 text-sm truncate">{place.name}</h4>
                    {place.formattedAddress && (
                      <p className="text-xs text-slate-400 truncate">{place.formattedAddress}</p>
                    )}
                    {place.rating !== undefined && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-500 stroke-amber-500" />
                        <span className="text-xs text-amber-400 font-semibold">{place.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Map Box */}
      <div className="flex-1 h-full relative" style={{ minHeight: '350px' }}>
        <Map
          defaultCenter={mapCenter}
          defaultZoom={mapZoom}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          gestureHandling="greedy"
          disableDefaultUI={false}
        >
          {/* Places Markers */}
          {places.map(place => (
            <AdvancedMarker
              key={place.id}
              position={place.location}
              ref={el => {
                markerRefs.current[place.id] = el;
              }}
              onClick={() => {
                setSelectedPlace(place);
                setActiveMarkerId(place.id);
                setInfoWindowOpen(true);
              }}
            >
              <Pin
                background={getMarkerPinColor(place)}
                borderColor="#1e293b"
                glyphColor="#fff"
              />
            </AdvancedMarker>
          ))}

          {/* Info Window */}
          {infoWindowOpen && selectedPlace && markerRefs.current[selectedPlace.id] && (
            <InfoWindow
              anchor={markerRefs.current[selectedPlace.id]}
              onCloseClick={() => {
                setInfoWindowOpen(false);
                setActiveMarkerId(null);
              }}
              className="custom-infowindow"
            >
              <div className="p-2 text-slate-950 font-sans max-w-[260px] space-y-2">
                {selectedPlace.photoUrl && (
                  <img
                    src={selectedPlace.photoUrl}
                    alt={selectedPlace.name}
                    className="w-full h-24 object-cover rounded-lg border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div>
                  <h4 className="font-bold text-sm text-slate-900 leading-tight">{selectedPlace.name}</h4>
                  {selectedPlace.formattedAddress && (
                    <p className="text-xs text-slate-500 mt-1">{selectedPlace.formattedAddress}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {selectedPlace.types?.slice(0, 3).map(type => (
                    <span
                      key={type}
                      className="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full capitalize"
                    >
                      {type.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>

                {selectedPlace.rating !== undefined && (
                  <div className="flex items-center gap-1 pt-1 border-t border-slate-100">
                    <Star className="w-3.5 h-3.5 fill-amber-500 stroke-amber-500" />
                    <span className="text-xs font-bold text-slate-700">{selectedPlace.rating.toFixed(1)} / 5.0</span>
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </Map>

        {/* Float Control Panel when empty */}
        {places.length === 0 && !computedRoute && (
          <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-md p-3.5 rounded-xl border border-slate-800 shadow-2xl flex items-center gap-3 max-w-[240px] z-[5] pointer-events-none md:pointer-events-auto">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h5 className="text-xs font-semibold text-slate-200">Interactive Map Live</h5>
              <p className="text-[10px] text-slate-400 mt-0.5">
                The chatbot can pan, zoom, draw directions, and search spots here dynamically.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
