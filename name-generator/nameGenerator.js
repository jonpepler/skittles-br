class NameGenerator {
  static newName () {
    const names = ["Republic of Amora", "Dawn Syndicate", "South Dreamland"]
    return names[Math.floor(Math.random() * names.length)]
  }
}
export default NameGenerator;