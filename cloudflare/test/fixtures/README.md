# Official Biennale HTML fixtures

These fixtures are minimized snapshots of official Gwangju Biennale HTML inspected on 2026-08-02 (Asia/Seoul). Tests never call the live site.

- `biennale-main-current-ko.html`: Korean current main-exhibition overview, from `https://www.gwangjubiennale.org/gb/exhibition/biennale/mainexhibition.do?subPage=overview`.
- `biennale-main-current-en.html`: English current main-exhibition overview, from `https://www.gwangjubiennale.org/en/exhibition/biennale/mainexhibition.do?subPage=overview`.
- `biennale-venues-current-ko.html`: Korean current venue page, from `https://www.gwangjubiennale.org/gb/exhibition/biennale/venues.do`. Venue content and independently verifiable dates were not populated at capture time.
- `biennale-venues-current-en.html`: English current venue page, from `https://www.gwangjubiennale.org/en/exhibition/biennale/venues.do`. Venue content and independently verifiable dates were not populated at capture time.
- `biennale-pavilion-venues.html`: official live edition-15 venue reference shape, from `https://www.gwangjubiennale.org/en/exhibition/past/15.do?subPageCode=venues`, retaining the real `h4`, `Hours`, `Address`, and Naver map-link structure.

The official pavilion overview endpoints inspected for edition context were `https://www.gwangjubiennale.org/gb/exhibition/biennale/pavilion.do` and `https://www.gwangjubiennale.org/en/exhibition/biennale/pavilion.do`. On the capture date they still described the 15th-edition pavilion program, so they are not used as a current-edition venue source.
