import { useState } from 'react';
import {
  clearPinnedFlowStep,
  readFlowPinEnabled,
  writeFlowPinEnabled,
} from '../lib/studio-flow-scope';

export const FLOW_PIN_CHANGED = 'hahmostudio-flow-pin-changed';

function notifyFlowPinChanged(): void {
  window.dispatchEvent(new CustomEvent(FLOW_PIN_CHANGED));
}

export default function FlowPinSettings() {
  const [enabled, setEnabled] = useState(() => readFlowPinEnabled());

  return (
    <fieldset className="flow-pin-settings">
      <legend>Tuotantovaihe</legend>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => {
            const next = e.target.checked;
            setEnabled(next);
            writeFlowPinEnabled(next);
            if (!next) clearPinnedFlowStep();
            notifyFlowPinChanged();
          }}
        />
        Rajaa paneelit valitun työvaiheen mukaan
      </label>
      <p>
        Kun päällä, yläpalkin työvaihevalinta lukitsee vasemman paneelin välilehdet ja käsikirjoituslähteen vaiheissa 2–5. Navigointi
        toimii aina.
      </p>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          clearPinnedFlowStep();
          notifyFlowPinChanged();
        }}
      >
        Nollaa työvaihe ja poista rajat
      </button>
      <p>Työvaihelistan valinta säilyy edelleen navigointina, kunnes valitset uuden vaiheen tai poistat pinin käytöstä.</p>
    </fieldset>
  );
}
