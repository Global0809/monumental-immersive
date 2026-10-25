import type { Video } from '../../data/catalogue';
import { go } from '../../services/router';
import { playSound, setSoundEnabled } from '../../services/audio';
import { useViewer } from '../../services/viewer';
import { enterSpatialWorld, requestSpatialTravel, rotateSpatialWorld, setSpatialFocus, spatialPortals, useSpatial } from '../../services/spatial';
import SpatialHub from './SpatialHub';

export default function SpatialHome({ onWatch, reducedMotion, soundUnavailable }: {
  onWatch: (video: Video) => void; reducedMotion: boolean; soundUnavailable: boolean;
}) {
  const spatial = useSpatial();
  const viewer = useViewer();
  return <div className="spatial-home-content" data-travelling={!!spatial.travelling} inert={!!spatial.travelling}><SpatialHub {...spatial} reducedMotion={reducedMotion} portals={spatialPortals}
    sound={viewer.sound} soundUnavailable={soundUnavailable}
    onToggleSound={() => setSoundEnabled(!viewer.sound)}
    onEnter={() => { enterSpatialWorld(); playSound('sculpture-unfold'); }}
    onFocus={setSpatialFocus}
    onNavigate={id => {
      const portal = spatialPortals.find(item => item.id === id);
      if (!portal) return;
      if (!requestSpatialTravel(id)) { enterSpatialWorld(); playSound('destination'); go(portal.route); }
    }}
    onRotate={delta => { rotateSpatialWorld(delta); playSound('select'); }}
    onWatch={onWatch}/></div>
}
