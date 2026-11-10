import * as xb from 'xrblocks';
import { SpatialStudioScript } from './scene/SpatialStudio';
import { AppShell } from './ui/AppShell';

document.addEventListener('DOMContentLoaded', () => {
  let shell: AppShell | null = null;

  const studioScript = new SpatialStudioScript((hudSnapshot) => {
    shell?.updateGameHud(hudSnapshot);
  });

  xb.add(studioScript);
  xb.init(new xb.Options());

  shell = new AppShell(studioScript);
});
