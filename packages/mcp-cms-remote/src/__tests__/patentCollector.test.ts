import { buildPatentQuery, formatToTsv, formatToJsonl } from '../patentCollector';

const samplePatents = [
  {
    patent_id: 'US-11234567-B2',
    patent_title: 'Method for distributed computing',
    patent_abstract: 'A method for efficiently distributing...',
    patent_date: '2026-03-28',
    assignees: [{ assignee_organization: 'Google LLC' }],
    inventors: [{ inventor_name_first: 'John', inventor_name_last: 'Smith' }],
    cpcs: [{ cpc_group_id: 'G06F' }],
  },
  {
    patent_id: 'US-11234568-A1',
    patent_title: 'Secure communication protocol',
    patent_abstract: 'A protocol for secure data...',
    patent_date: '2026-03-27',
    assignees: [{ assignee_organization: 'Microsoft Corporation' }],
    inventors: [
      { inventor_name_first: 'Jane', inventor_name_last: 'Doe' },
      { inventor_name_first: 'Bob', inventor_name_last: 'Lee' },
    ],
    cpcs: [{ cpc_group_id: 'H04L' }],
  },
];

describe('buildPatentQuery', () => {
  it('builds query from CPC codes and date range', () => {
    const result = buildPatentQuery(['G06', 'H04L'], 30, '2026-04-01');

    expect(result.q).toEqual({
      _and: [
        {
          _or: [
            { _text_any: { cpc_group_id: 'G06' } },
            { _text_any: { cpc_group_id: 'H04L' } },
          ],
        },
        { _gte: { patent_date: '2026-03-02' } },
      ],
    });
    expect(result.f).toEqual([
      'patent_id',
      'patent_title',
      'patent_abstract',
      'patent_date',
      'assignees.assignee_organization',
      'inventors.inventor_name_first',
      'inventors.inventor_name_last',
      'cpcs.cpc_group_id',
    ]);
    expect(result.s).toEqual([{ patent_date: 'desc' }]);
    expect(result.o).toEqual({ size: 20 });
  });

  it('accepts custom fetchCount', () => {
    const result = buildPatentQuery(['G06'], 7, '2026-04-01', 50);

    expect(result.o).toEqual({ size: 50 });
    expect(result.q).toEqual({
      _and: [
        { _or: [{ _text_any: { cpc_group_id: 'G06' } }] },
        { _gte: { patent_date: '2026-03-25' } },
      ],
    });
  });
});

describe('formatToTsv', () => {
  it('generates header and data rows', () => {
    const tsv = formatToTsv(samplePatents);
    const lines = tsv.split('\n');

    expect(lines[0]).toBe('patent_id\tdate\tassignee\tcpc\ttitle');
    expect(lines[1]).toBe(
      'US-11234567-B2\t2026-03-28\tGoogle LLC\tG06F\tMethod for distributed computing',
    );
    expect(lines[2]).toBe(
      'US-11234568-A1\t2026-03-27\tMicrosoft Corporation\tH04L\tSecure communication protocol',
    );
    expect(lines).toHaveLength(3);
  });

  it('returns header only for empty array', () => {
    const tsv = formatToTsv([]);
    expect(tsv).toBe('patent_id\tdate\tassignee\tcpc\ttitle');
  });
});

describe('formatToJsonl', () => {
  it('converts each patent to a single JSON line', () => {
    const jsonl = formatToJsonl(samplePatents);
    const lines = jsonl.split('\n');

    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(first).toEqual({
      patent_id: 'US-11234567-B2',
      title: 'Method for distributed computing',
      abstract: 'A method for efficiently distributing...',
      date: '2026-03-28',
      assignees: ['Google LLC'],
      inventors: ['John Smith'],
      cpc: ['G06F'],
    });

    const second = JSON.parse(lines[1]) as Record<string, unknown>;
    expect(second.inventors).toEqual(['Jane Doe', 'Bob Lee']);
  });

  it('returns empty string for empty array', () => {
    expect(formatToJsonl([])).toBe('');
  });
});
