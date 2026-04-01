import { buildCqlQuery, formatToTsv, formatToJsonl, parseEpoResponse } from '../patentCollector';

const samplePatents = [
  {
    patent_id: 'EP1000000B1',
    patent_title: 'Method for distributed computing',
    patent_abstract: 'A method for efficiently distributing...',
    patent_date: '2026-03-28',
    assignees: ['Google LLC'],
    inventors: ['John Smith'],
    cpcs: ['G06F 9/50'],
  },
  {
    patent_id: 'US11234568A1',
    patent_title: 'Secure communication protocol',
    patent_abstract: 'A protocol for secure data...',
    patent_date: '2026-03-27',
    assignees: ['Microsoft Corporation'],
    inventors: ['Jane Doe', 'Bob Lee'],
    cpcs: ['H04L 9/32'],
  },
];

describe('buildCqlQuery', () => {
  it('builds CQL query from CPC codes and date range', () => {
    const cql = buildCqlQuery(['G06', 'H04L'], 30, '2026-04-01');
    expect(cql).toBe('(cpc=G06 OR cpc=H04L) AND pd>=20260302');
  });

  it('handles single CPC code', () => {
    const cql = buildCqlQuery(['G06'], 7, '2026-04-01');
    expect(cql).toBe('(cpc=G06) AND pd>=20260325');
  });
});

describe('formatToTsv', () => {
  it('generates header and data rows', () => {
    const tsv = formatToTsv(samplePatents);
    const lines = tsv.split('\n');

    expect(lines[0]).toBe('patent_id\tdate\tassignee\tcpc\ttitle');
    expect(lines[1]).toBe(
      'EP1000000B1\t2026-03-28\tGoogle LLC\tG06F 9/50\tMethod for distributed computing',
    );
    expect(lines[2]).toBe(
      'US11234568A1\t2026-03-27\tMicrosoft Corporation\tH04L 9/32\tSecure communication protocol',
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
      patent_id: 'EP1000000B1',
      title: 'Method for distributed computing',
      abstract: 'A method for efficiently distributing...',
      date: '2026-03-28',
      assignees: ['Google LLC'],
      inventors: ['John Smith'],
      cpc: ['G06F 9/50'],
    });

    const second = JSON.parse(lines[1]) as Record<string, unknown>;
    expect(second.inventors).toEqual(['Jane Doe', 'Bob Lee']);
  });

  it('returns empty string for empty array', () => {
    expect(formatToJsonl([])).toBe('');
  });
});

describe('parseEpoResponse', () => {
  const sampleXml = `
<ops:world-patent-data xmlns:ops="http://ops.epo.org">
  <ops:biblio-search>
    <ops:search-result>
      <exchange-documents>
        <exchange-document country="EP" doc-number="1000000" kind="B1" family-id="12345">
          <bibliographic-data>
            <publication-reference>
              <document-id document-id-type="docdb">
                <date-of-publication>20260328</date-of-publication>
              </document-id>
            </publication-reference>
            <invention-title lang="en">Method for distributed computing</invention-title>
            <parties>
              <applicants>
                <applicant data-format="docdba">
                  <name>Google LLC</name>
                </applicant>
              </applicants>
              <inventors>
                <inventor data-format="docdba">
                  <name>Smith, John</name>
                </inventor>
              </inventors>
            </parties>
            <patent-classifications>
              <patent-classification>
                <classification-scheme scheme="CPC"/>
                <text>G06F 9/50</text>
              </patent-classification>
            </patent-classifications>
          </bibliographic-data>
          <abstract lang="en"><p>A method for efficiently distributing tasks.</p></abstract>
        </exchange-document>
      </exchange-documents>
    </ops:search-result>
  </ops:biblio-search>
</ops:world-patent-data>`;

  it('extracts patent data from XML', () => {
    const patents = parseEpoResponse(sampleXml);

    expect(patents).toHaveLength(1);
    expect(patents[0].patent_id).toBe('EP1000000B1');
    expect(patents[0].patent_title).toBe('Method for distributed computing');
    expect(patents[0].patent_date).toBe('2026-03-28');
    expect(patents[0].assignees).toEqual(['Google LLC']);
    expect(patents[0].inventors).toEqual(['Smith, John']);
    expect(patents[0].cpcs).toEqual(['G06F 9/50']);
    expect(patents[0].patent_abstract).toBe('A method for efficiently distributing tasks.');
  });

  it('returns empty array for empty XML', () => {
    const patents = parseEpoResponse('<ops:world-patent-data></ops:world-patent-data>');
    expect(patents).toEqual([]);
  });
});
