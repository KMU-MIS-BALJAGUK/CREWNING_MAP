// src/components/KakaoMap.jsx
import React, { useEffect, useState } from 'react';
import { Map, CustomOverlayMap, Polygon } from 'react-kakao-maps-sdk';
import { supabase } from '../api/supabaseClient';
import './KakaoMap.css';

// seoulGuCoords (구 중심 좌표)
const seoulGuCoords = {
  종로구: { lat: 37.59491732, lng: 126.9773213 },
  중구: { lat: 37.56014356, lng: 126.9959681 },
  용산구: { lat: 37.53138497, lng: 126.979907 },
  성동구: { lat: 37.55102969, lng: 127.0410585 },
  광진구: { lat: 37.54670608, lng: 127.0857435 },
  동대문구: { lat: 37.58195655, lng: 127.0548481 },
  중랑구: { lat: 37.59780259, lng: 127.0928803 },
  성북구: { lat: 37.6057019, lng: 127.0175795 },
  강북구: { lat: 37.64347391, lng: 127.011189 },
  도봉구: { lat: 37.66910208, lng: 127.0323688 },
  노원구: { lat: 37.65355446, lng: 127.0700086 },
  은평구: { lat: 37.61895015, lng: 126.9249795 },
  서대문구: { lat: 37.57556734, lng: 126.9360879 },
  마포구: { lat: 37.55909981, lng: 126.903366 },
  양천구: { lat: 37.52044549, lng: 126.857032 },
  강서구: { lat: 37.56123543, lng: 126.8316823 },
  구로구: { lat: 37.49944596, lng: 126.852417 },
  금천구: { lat: 37.45688636, lng: 126.897912 },
  영등포구: { lat: 37.52064103, lng: 126.900181 },
  동작구: { lat: 37.49887739, lng: 126.9513735 },
  관악구: { lat: 37.46739665, lng: 126.946894 },
  서초구: { lat: 37.47214013, lng: 127.031174 },
  강남구: { lat: 37.49664389, lng: 127.0629852 },
  송파구: { lat: 37.5056775, lng: 127.111417 },
  강동구: { lat: 37.55045024, lng: 127.1470118 },
};

const COLORS = ['#e8f5ff', '#d4edff', '#c0e5ff', '#acceff', '#98c6ff', '#84beff'];

function getFillColor(name) {
  if (!name) return '#fff';
  const hash = Array.from(name).reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7);
  return COLORS[Math.abs(hash) % COLORS.length];
}

const KakaoMap = () => {
  const [topCrews, setTopCrews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [polygons, setPolygons] = useState([]);
  const seoulCenter = { lat: 37.5665, lng: 126.978 };

  // wait for kakao sdk helper
  const waitForKakao = () =>
    new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && window.kakao && window.kakao.maps) return resolve(window.kakao);
      let tries = 0;
      const iv = setInterval(() => {
        tries += 1;
        if (window.kakao && window.kakao.maps) {
          clearInterval(iv);
          return resolve(window.kakao);
        }
        if (tries > 100) {
          clearInterval(iv);
          return reject(new Error('kakao sdk load timeout'));
        }
      }, 100);
    });

  // GeoJSON 로드 및 파싱(Polygon / MultiPolygon 안전 처리)
 useEffect(() => {
    let mounted = true;

    const waitForKakao = () =>
      new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && window.kakao && window.kakao.maps) return resolve(window.kakao);
        let tries = 0;
        const iv = setInterval(() => {
          tries += 1;
          if (window.kakao && window.kakao.maps) {
            clearInterval(iv);
            return resolve(window.kakao);
          }
          if (tries > 100) {
            clearInterval(iv);
            return reject(new Error('kakao sdk load timeout'));
          }
        }, 100);
      });

    (async () => {
      try {
        await waitForKakao();
      } catch (e) {
        console.error('카카오 SDK 로드 실패:', e);
      }

      try {
        // 1. /seoul.geojson 파일을 fetch합니다.
        const res = await fetch('/seoul.geojson');
        console.log('seoul.geojson status:', res.status, 'content-type:', res.headers.get('content-type'));

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`GeoJSON fetch failed: ${res.status} ${res.statusText} - ${txt.slice(0,200)}`);
        }

        // 2. [핵심 수정] 
        // S3가 Content-Type을 잘못 보내줘도 무시하고,
        // .text()로 받은 뒤 JSON.parse()로 강제 파싱합니다.
        const geojsonText = await res.text();
        const geojson = JSON.parse(geojsonText);
        // (기존의 Content-Type 체크 로직과 res.json()을 위 두 줄로 대체)

        console.log('geojson keys:', Object.keys(geojson));
        const features = geojson.features || [];
        console.log('features count:', features.length);

        const polygonData = features.flatMap((feature, fIdx) => {
          const geom = feature.geometry;
          if (!geom) {
            console.warn('no geometry for feature', fIdx, feature);
            return [];
          }

          // Polygon
          if (geom.type === 'Polygon') {
            // coords: [ [ [lng, lat], ... ], ...rings ]
            const outer = geom.coordinates?.[0];
            if (!outer || outer.length === 0) {
              console.warn('empty polygon coords for feature', fIdx);
              return [];
            }
            // kakao-map-sdk가 plain {lat,lng}을 잘 받는 경우가 많으므로 plain object로 만듦
            const path = outer.map((coord) => ({ lat: coord[1], lng: coord[0] }));
            return [{ name: feature.properties?.SIG_KOR_NM || `f${fIdx}`, path }];
          }

          // MultiPolygon
          if (geom.type === 'MultiPolygon') {
            // coords: [ [ [ [lng,lat],... ] ], ...polygons ]
            return geom.coordinates.map((polyCoords, pIdx) => {
              const outer = polyCoords?.[0];
              if (!outer || outer.length === 0) {
                console.warn('empty multipolygon inner coords', fIdx, pIdx);
                return null;
              }
              const path = outer.map((coord) => ({ lat: coord[1], lng: coord[0] }));
              return { name: feature.properties?.SIG_KOR_NM || `f${fIdx}_p${pIdx}`, path };
            }).filter(Boolean);
          }

          console.warn('unsupported geometry type:', geom.type);
          return [];
        });

        console.log('polygonData length:', polygonData.length);
        if (polygonData.length > 0) {
          console.log('first polygon sample:', polygonData[0].name, polygonData[0].path.slice(0, 5));
        }

        if (mounted) setPolygons(polygonData);
      } catch (err) {
        console.error('GeoJSON 처리 오류:', err);
      }
    })();

    return () => { mounted = false; };
  }, []);

  // 1등 크루 데이터를 불러오는 useEffect
  useEffect(() => {
    const fetchTopCrews = async () => {
      // ⬇️ [수정됨] RPC 대신 엣지 펑션을 호출하도록 로그 수정
      console.log("KakaoMap.jsx: useEffect 실행. 엣지 펑션 호출 시도...");
      setIsLoading(true); 

      // ⬇️ [핵심 수정]
      // supabase.rpc(...) 대신, 새로 만드신 엣지 펑션을 호출합니다.
      const { data, error } = await supabase.functions.invoke(
        'get_weekly_top_crew_by_gu' // ⬅️ 새로 만드신 펑션 이름
      );

      if (error) {
        // ⬇️ [수정됨] 에러 로그 메시지 수정
        console.error("🔥 엣지 펑션('get_weekly_top_crew_by_gu') 호출 실패:", error);
        setIsLoading(false); 
        return;
      }

      // ⬇️ [수정됨] 성공 로그 메시지 수정
      console.log("✅ 엣지 펑션 호출 성공. 반환된 데이터(data):", data);

      // (이하 코드는 전혀 수정할 필요가 없습니다. 반환되는 data 형식이 동일합니다.)
      const crewsWithCoords = data
        .map((crew) => {
          const position = seoulGuCoords[crew.gu_name];
          if (!position) {
            console.warn(`⚠️ '${crew.gu_name}'에 대한 좌표를 찾지 못했습니다.`);
          }
          return { ...crew, position: position };
        })
        .filter((crew) => crew.position);

      console.log("데이터 매핑 완료:", crewsWithCoords);
      setTopCrews(crewsWithCoords);
      setIsLoading(false);
    };

    fetchTopCrews();
  }, []);

  // 로딩 UI: (원하면 항상 지도를 보여주게 수정 가능)
  if (isLoading) {
    return <div>지도 및 랭킹 데이터를 불러오는 중...</div>;
  }

  return (
    <Map
      center={seoulCenter}
      style={{ width: '100%', height: '100%' }}
      level={9}
    >
      {polygons.map((poly, idx) => (
        <Polygon
          key={`${poly.name}-${idx}`}
          path={poly.path}           // [{lat, lng}, ...]
          strokeWeight={2}           // 화면상 더 보기 좋은 얇은 선
          strokeColor={'#004c80'}
          strokeOpacity={0.9}
          fillColor={getFillColor(poly.name)}
          fillOpacity={1}
        />
      ))}

      {Object.entries(seoulGuCoords).map(([guName, position]) => (
        <CustomOverlayMap key={guName} position={position} yAnchor={0.5}>
          <div className="gu-label">{guName}</div>
        </CustomOverlayMap>
      ))}

      {/* 1등 크루 오버레이 */}
      {topCrews.map((crew) => (
        
        <CustomOverlayMap
          key={crew.gu_name}
          position={crew.position}
          yAnchor={1.2}
        >
          <div className="crew-overlay">
            {crew.logo_url ? (
              <>
                <img
                  src={crew.logo_url}
                  alt={crew.crew_name}
                  className="crew-logo"
                />
                <span className="crew-name">{crew.crew_name}</span>
              </>
      ) : (
        <div className="crew-no-logo">
          {crew.crew_name}
        </div>
      )}
          </div>
        </CustomOverlayMap>
      ))}
    </Map>
  );
};

export default KakaoMap;
