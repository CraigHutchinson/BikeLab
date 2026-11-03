"""Compare hash-verified exact replay diagnostics; this sets no acceptance budget."""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ordered_bits(value):
    bits = struct.unpack('<Q', struct.pack('<d', value))[0]
    magnitude = bits & ((1 << 63) - 1)
    return -magnitude if bits >> 63 else magnitude  # signed zeros coincide


def inspect(left_path, right_path):
    left = json.loads(left_path.read_text())
    right = json.loads(right_path.read_text())
    assert left['format'] == right['format'] == 'bikelab-legacy-replay-diagnostic-0.1'
    for diagnostic in [left, right]:
        assert sha(diagnostic['xml'].encode('utf-8')) == diagnostic['xmlSha256'], 'XML hash mismatch'
    result = {'left': str(left_path), 'right': str(right_path),
              'runtime': [left['runtime'], right['runtime']],
              'hashes': [left['actualHash'], right['actualHash']],
              'sameSources': left['sourcesSha256'] == right['sourcesSha256'],
              'sameXML': left['xml'] == right['xml'],
              'sameParams': left['record']['params'] == right['record']['params'],
              'sameInitial': left['record']['initial'] == right['record']['initial'],
              'summaryDifferences': {k: [v, right['record']['summary'][k]] for k, v in left['record']['summary'].items()
                                     if v != right['record']['summary'][k]},
              'scope': 'Exact binary differences and absolute/ULP distances for localization only; signed zeros share ULP coordinate. Metadata comparisons use JSON numeric equality, which cannot retain signed zero; actualHash is reported metadata from the JS capture, not reconstructed by Python. No tolerance or acceptance decision.'}
    for kind in ['signals', 'forcing']:
        descriptors = [left[kind], right[kind]]
        for key in ['encoding', 'layout', 'columns', 'count', 'bytes']:
            assert descriptors[0][key] == descriptors[1][key], (kind, key)
        columns, count, layout = (descriptors[0][k] for k in ['columns', 'count', 'layout'])
        assert descriptors[0]['encoding'] == 'float64 little-endian'
        assert layout in ['channel-major', 'row-major'] and isinstance(count, int) and count > 0
        assert len(set(columns)) == len(columns)
        raw = []
        for path, descriptor in zip([left_path, right_path], descriptors):
            assert Path(descriptor['file']).name == descriptor['file']
            data = (path.parent / descriptor['file']).read_bytes()
            assert len(data) == descriptor['bytes'] == 8 * len(columns) * count
            assert sha(data) == descriptor['sha256']
            raw.append(data)
        series = []
        for k, column in enumerate(columns):
            first, differences, max_absolute, max_ulp = None, 0, 0.0, 0
            for i in range(count):
                offset = 8 * (k * count + i if layout == 'channel-major' else i * len(columns) + k)
                bits = [data[offset:offset+8] for data in raw]
                a, b = [struct.unpack('<d', x)[0] for x in bits]
                assert math.isfinite(a) and math.isfinite(b)
                if bits[0] == bits[1]:
                    continue
                differences += 1
                distance = abs(ordered_bits(a) - ordered_bits(b))
                max_absolute = max(max_absolute, abs(a-b))
                max_ulp = max(max_ulp, distance)
                if first is None:
                    first = {'sample': i, 'values': [repr(a), repr(b)],
                             'bitsHexLE': [x.hex() for x in bits], 'ulpDistance': distance}
            if first is not None:
                series.append({'column': column, 'differentSamples': differences, 'first': first,
                               'maxAbsoluteDifference': max_absolute, 'maxULPDistance': max_ulp})
        result[kind] = {'equalBytes': raw[0] == raw[1], 'differences': series}
    return result


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Usage: python scripts/compare-legacy-replay.py LEFT.json RIGHT.json'
    print(json.dumps(inspect(Path(sys.argv[1]), Path(sys.argv[2])), indent=2))
