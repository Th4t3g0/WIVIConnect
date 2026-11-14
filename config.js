/* Google Forms backend settings.
   Leave a section empty to run it in DEMO MODE (saved in this browser only).
   Follow SETUP.md to fill them in. */

const CONFIG = {

  /* ===== 1) ACCOUNTS (register / login) ===== */
  FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLScStD-YI81OaEgs2CV1zUrs5ltlS638wjidJgcjAQCoMVVUsA/formResponse',
  SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRL7lZJ3fojauAz9DlhoWRXhq-vY3XWaQm5JGHnZlzWDyyEkDui-Fo_rdis703eYCR5WQLaZlu5wF9Q/pub?gid=1044174163&single=true&output=csv',
  ENTRIES: {
    id:           'entry.405434500',
    role:         'entry.960710239',
    name:         'entry.386120708',
    email:        'entry.496624672',
    passwordHash: 'entry.403049199',
    details:      'entry.6403882',
  },

  /* ===== 2) APP DATA (requests, quotes, products, orders) ===== */
  DATA: {
    FORM_URL: 'https://docs.google.com/forms/d/e/1FAIpQLSeYdQk5t2WsC8w4xjNBe90shp2D7FUKiQACfyK4fGVGj3hudw/formResponse',
    SHEET_CSV_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRsLoSbhz5BFWP3w0jHkKTW_UUKI87fwox_6801r9ad1C7fqbtuGBoYVo1hXbGayhrWhDU-TAXEx74_/pub?gid=1206599275&single=true&output=csv',
    ENTRIES: {
      eid:        'entry.1621008412',
      collection: 'entry.973250175',
      id:         'entry.2012852569',
      data:       'entry.926854192',
    },
  },
};