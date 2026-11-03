"""Decode the 48-bit paint timestamp from CUA screenshots of the real receiver.
Usage: python3 scripts/read-latency-samples.py output/native/latency/samples.json
Requires Pillow. Screenshots are read only; this does not drive or capture UI.
The screenshot call bounds are observation bounds, not photon-to-photon timing.
"""
import json
import statistics
import sys
from pathlib import Path
from PIL import Image


def runs(values):
    result = []
    start = None
    for i, value in enumerate(values + [False]):
        if value and start is None:
            start = i
        elif not value and start is not None:
            if i - start >= 4:
                result.append((start, i))
            start = None
    return result


def decode(path, start, end):
    if end < start:
        raise ValueError('Screenshot end precedes start; check the observation clock')
    image = Image.open(path).convert('RGB')
    votes = []
    for y in range(0, image.height, 3):
        row = [image.getpixel((x, y)) for x in range(image.width)]
        reds = runs([r > 170 and g < 100 and b < 100 for r, g, b in row])
        blues = runs([b > 150 and r < 100 and g < 130 for r, g, b in row])
        for left, right in reds:
            for blue, blue_end in blues:
                cell = (blue - left) / 51
                if cell < 2 or abs((right - left) / cell - 3) > .6 or abs((blue_end - blue) / cell - 3) > .6:
                    continue
                bits = []
                for bit in range(48):
                    rgb = row[round(left + (3.5 + bit) * cell)]
                    if min(rgb) > 160:
                        bits.append('1')
                    elif max(rgb) < 100:
                        bits.append('0')
                    else:
                        break
                if len(bits) == 48:
                    value = int(''.join(bits), 2)
                    if start - 60_000 < value <= end:
                        votes.append(value)
    if not votes:
        raise ValueError(f'No valid timestamp found in {path}')
    timestamp = statistics.mode(votes)
    if votes.count(timestamp) < 3:
        raise ValueError(f'Timestamp lacks three-row agreement in {path}')
    return {'paint_ms': timestamp, 'lower_ms': start - timestamp, 'upper_ms': end - timestamp,
            'observation_ms': end - start, 'matching_rows': votes.count(timestamp)}


def summarise(results):
    if not results:
        raise ValueError('No samples supplied')
    return {'samples': len(results),
            'median_lower_ms': statistics.median(r['lower_ms'] for r in results),
            'median_upper_ms': statistics.median(r['upper_ms'] for r in results),
            'min_lower_ms': min(r['lower_ms'] for r in results),
            'max_upper_ms': max(r['upper_ms'] for r in results),
            'median_observation_ms': statistics.median(r['observation_ms'] for r in results)}


if __name__ == '__main__':
    manifest = Path(sys.argv[1])
    samples = json.loads(manifest.read_text())
    results = []
    for sample in samples:
        result = decode(manifest.parent / sample['file'], sample['start'], sample['end'])
        results.append({**sample, **result})
    summary = summarise(results)
    groups = {kind: summarise([r for r in results if r.get('kind') == kind])
              for kind in sorted({r['kind'] for r in results if 'kind' in r})}
    report = {'summary': summary, 'groups': groups, 'samples': results}
    manifest.with_name('results.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'summary': summary, 'groups': groups}, indent=2))
