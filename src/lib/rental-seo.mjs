export const RENTAL_CANONICAL_PATH = '/rental'
export const RENTAL_TITLE = '광주 전시공간 대관 | 예술전시·워크숍 Space DDF'
export const RENTAL_DESCRIPTION = '광주 동구 Space DDF의 예술전시·워크숍 공간 대관 안내입니다. 사진, 영상, 설치, 사운드, 출판, 리서치 기반 프로젝트의 대관 가능 일정을 확인하고 온라인으로 신청하세요.'

export const RENTAL_FAQS = Object.freeze([
  Object.freeze({
    question: '어떤 프로젝트를 대관 신청할 수 있나요?',
    answer: '예술전시와 사진, 영상, 설치, 사운드, 출판, 리서치 기반 프로젝트 및 예술 워크숍을 신청할 수 있습니다.',
  }),
  Object.freeze({
    question: '대관 일정은 어떻게 선택하나요?',
    answer: '페이지의 대관 가능 일정 안에서 시작일과 종료일을 차례로 선택한 뒤 신청서를 작성합니다.',
  }),
  Object.freeze({
    question: '신청 후 바로 확정되나요?',
    answer: '접수 후 공간과 일정 검토를 거쳐 승인 여부와 결제 방법을 별도로 안내합니다.',
  }),
  Object.freeze({
    question: '문화예술 지원사업 할인이 있나요?',
    answer: 'K-ART, 광주문화재단 등 문화예술 지원사업 준비자는 10% 할인을 검토합니다.',
  }),
])

export function rentalStructuredData({ siteUrl, venue }) {
  const canonical = new URL(RENTAL_CANONICAL_PATH, siteUrl).href
  const organizationId = venue?.['@id'] || `${siteUrl}/#organization`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Space DDF', item: new URL('/', siteUrl).href },
          { '@type': 'ListItem', position: 2, name: '광주 전시공간 대관', item: canonical },
        ],
      },
      {
        '@type': 'Service',
        '@id': `${canonical}#service`,
        name: 'Space DDF 예술전시·워크숍 공간 대관',
        description: RENTAL_DESCRIPTION,
        url: canonical,
        provider: { '@id': organizationId },
        areaServed: { '@type': 'City', name: '광주광역시' },
        serviceType: '예술전시 및 예술 워크숍 공간 대관',
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonical}#faq`,
        mainEntity: RENTAL_FAQS.map(item => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      venue,
    ].filter(Boolean),
  }
}
