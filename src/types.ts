export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapPlace {
  id: string;
  name: string;
  formattedAddress?: string;
  location: LatLng;
  rating?: number;
  types?: string[];
  photoUrl?: string;
}

export interface MapRoute {
  origin: string;
  destination: string;
  travelMode: string;
  distance?: string;
  duration?: string;
  path: LatLng[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isPending?: boolean;
  functionCalls?: any[] | null;
  functionResponse?: {
    name: string;
    response: any;
  };
  groundingSources?: GroundingSource[];
}
